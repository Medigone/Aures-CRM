# Copyright (c) 2026, AURES Technologies and contributors
# For license information, please see license.txt

from __future__ import annotations

import datetime
from collections import defaultdict

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, formatdate, get_url_to_form, getdate, now, today

DOSSIER_APERCU_TEMPLATE = "templates/dossier_fabrication/apercu.html"

# Doit rester aligné sur `options` du champ naming_series dans dossier_fabrication.json (pas DF-, réservé ailleurs).
DOSSIER_FABRICATION_NAMING_SERIES = "DOF-.YYYY.-"


def _pick_feasibility_study(feasibility_studies: list) -> dict | None:
	for study in feasibility_studies:
		if study.get("trace") and study.get("imposition"):
			return study
	return None


def _maquettes_map_for_sales_order(sales_order_name: str) -> dict[str, str]:
	maquettes_data: dict[str, str] = {}
	try:
		rows = frappe.get_all(
			"Maquettes Articles Commande",
			filters={"parent": sales_order_name},
			fields=["article", "maquette"],
		)
		for m in rows:
			if m.article and m.maquette:
				maquettes_data[m.article] = m.maquette
	except Exception as e:
		frappe.log_error(
			f"Erreur maquettes pour commande {sales_order_name}: {e}",
			"dossier_fabrication_maquettes",
		)
	return maquettes_data


def _latest_bat_for_item(item_code: str) -> str | None:
	existing_bat = frappe.get_all(
		"BAT",
		filters={"article": item_code, "status": "BAT-P Validé"},
		fields=["name"],
		order_by="date desc",
		limit=1,
	)
	if existing_bat:
		return existing_bat[0].name
	existing_bat_e = frappe.get_all(
		"BAT",
		filters={"article": item_code, "status": "BAT-E Validé"},
		fields=["name"],
		order_by="date desc",
		limit=1,
	)
	if existing_bat_e:
		return existing_bat_e[0].name
	return None


def _niveau_urgence_pour_dossier(sales_order_doc, demande_name: str | None) -> str:
	allowed = ("U0", "U1", "U2", "U3")
	nu = getattr(sales_order_doc, "custom_niveau_urgence", None)
	if nu in allowed:
		return nu
	so_name = getattr(sales_order_doc, "name", None) or sales_order_doc.get("name")
	if so_name:
		nu = frappe.db.get_value("Sales Order", so_name, "custom_niveau_urgence")
		if nu in allowed:
			return nu
	if demande_name:
		nu = frappe.db.get_value("Demande Faisabilite", demande_name, "niveau_urgence")
		if nu in allowed:
			return nu
	return "U0"


def _totaux_commandes_par_article(doc: Document) -> dict[str, float]:
	totals: dict[str, float] = defaultdict(float)
	for ln in doc.get("lignes") or []:
		if ln.article:
			totals[ln.article] += flt(ln.quantite_commandee)
	return dict(totals)


def _sommes_programme_par_article(doc: Document) -> tuple[dict[str, float], dict[str, float]]:
	programmed: dict[str, float] = defaultdict(float)
	produced: dict[str, float] = defaultdict(float)
	for pr in doc.get("programme_livraison") or []:
		if not pr.article:
			continue
		programmed[pr.article] += flt(pr.quantite_a_produire)
		produced[pr.article] += flt(pr.quantite_produite or 0)
	return dict(programmed), dict(produced)


def _sync_statuts_programme(doc: Document) -> None:
	for prow in doc.get("programme_livraison") or []:
		qa = flt(prow.quantite_a_produire)
		qp = flt(prow.quantite_produite or 0)
		if prow.etude_technique:
			if qa > 0 and qp + 1e-9 >= qa:
				prow.statut = "Terminé"
			else:
				prow.statut = "Étude créée"
		else:
			prow.statut = "Planifié"


def _sync_ligne_aggregates_from_programme(doc: Document) -> None:
	tot_cmd_by_art = _totaux_commandes_par_article(doc)
	programmed_by_art, produced_by_art = _sommes_programme_par_article(doc)

	for ln in doc.get("lignes") or []:
		if not ln.article:
			continue
		art = ln.article
		tot_cmd_article = tot_cmd_by_art.get(art, 0) or flt(ln.quantite_commandee)
		share = (flt(ln.quantite_commandee) / tot_cmd_article) if tot_cmd_article > 0 else 1.0
		total_prog = programmed_by_art.get(art, 0.0)
		total_prod = produced_by_art.get(art, 0.0)
		ln.quantite_programmee = total_prog * share
		ln.quantite_produite = total_prod * share
		ln.quantite_restante_a_programmer = flt(ln.quantite_commandee) - ln.quantite_programmee
		ln.quantite_restante_a_produire = flt(ln.quantite_commandee) - ln.quantite_produite

		t_cmd = tot_cmd_by_art.get(art, 0)
		t_prog = programmed_by_art.get(art, 0)
		if t_prog <= 0:
			ln.statut_article = "À programmer"
		elif t_prog + 1e-6 < t_cmd:
			ln.statut_article = "Programmation partielle"
		else:
			ln.statut_article = "Programmation complète"


def _first_ligne_for_article(doc: Document, article: str):
	for ln in doc.get("lignes") or []:
		if ln.article == article:
			return ln
	return None


def _is_planification_locked(doc: Document) -> bool:
	return bool(getattr(doc, "planification_validee", 0))


def _ensure_planification_editable(doc: Document) -> None:
	if _is_planification_locked(doc):
		frappe.throw(
			_("La planification est validée : le programme livraison ne peut plus être modifié."),
			title=_("Planification verrouillée"),
		)


def _validate_offset_machine(machine_name: str | None) -> None:
	"""Machine vide autorisée ; sinon presse offset (aligné planning charge machines)."""
	if not machine_name:
		return
	if not frappe.db.exists(
		"Machine",
		{
			"name": machine_name,
			"type_equipement": "Presse Offset",
			"procede": "Offset",
		},
	):
		frappe.throw(
			_("Sélectionnez une presse offset (procédé Offset) ou laissez vide."),
			title=_("Machine"),
		)


def _programme_row_for_name(doc: Document, programme_row_name: str):
	for r in doc.get("programme_livraison") or []:
		if r.name == programme_row_name:
			return r
	return None


def _sync_etude_technique_planning_from_programme_row(row) -> None:
	if not row.etude_technique or not frappe.db.exists("Etude Technique", row.etude_technique):
		return
	_et_meta = frappe.get_meta("Etude Technique")
	updates: dict[str, object] = {}
	if row.machine and _et_meta.has_field("machine"):
		updates["machine"] = row.machine
	if getattr(row, "date_fabrication_prevue", None) and _et_meta.has_field("date_planification_production"):
		updates["date_planification_production"] = row.date_fabrication_prevue
	if updates:
		frappe.db.set_value("Etude Technique", row.etude_technique, updates)
		if "machine" in updates and _et_meta.has_field("nb_passages"):
			from aurescrm.passages import update_etude_technique_passages

			update_etude_technique_passages(row.etude_technique)


def _sync_passages(doc: Document) -> None:
	"""nb_passages des lignes et du programme selon (article, machine) ; cache par couple."""
	from aurescrm.passages import get_nb_passages

	cache: dict[tuple[str, str], int] = {}

	def _np(article: str | None, machine: str | None) -> int:
		if not article or not machine:
			return 0
		key = (article, machine)
		if key not in cache:
			cache[key] = get_nb_passages(article, machine)
		return cache[key]

	for ln in doc.get("lignes") or []:
		ln.nb_passages = _np(ln.article, ln.machine)
	for prow in doc.get("programme_livraison") or []:
		prow.nb_passages = _np(prow.article, prow.machine)


def _dossier_ligne_has_delivery_date_field() -> bool:
	return frappe.get_meta("Dossier Fabrication Ligne").has_field("date_livraison_commande")


def _sales_order_delivery_dates_by_item(sales_order_doc) -> dict[str, str]:
	"""Date livraison par article depuis les lignes de commande client."""
	out: dict[str, str] = {}
	header_date = getattr(sales_order_doc, "delivery_date", None)
	for item in sales_order_doc.get("items") or []:
		if not item.item_code or item.item_code in out:
			continue
		out[item.item_code] = (
			getattr(item, "delivery_date", None)
			or getattr(item, "schedule_date", None)
			or header_date
		)
	return out


def _sync_ligne_delivery_dates_from_sales_order(doc: Document) -> None:
	if not doc.sales_order or not _dossier_ligne_has_delivery_date_field():
		return
	so = frappe.get_doc("Sales Order", doc.sales_order)
	dates_by_item = _sales_order_delivery_dates_by_item(so)
	for ln in doc.get("lignes") or []:
		if ln.article and not getattr(ln, "date_livraison_commande", None):
			ln.date_livraison_commande = dates_by_item.get(ln.article)


def _ensure_programme_date_fabrication_prevue(doc: Document) -> None:
	"""Complète date_fabrication_prevue avant _validate_mandatory (le validate des lignes enfants ne s'exécute pas encore)."""
	for row in doc.get("programme_livraison") or []:
		if getattr(row, "date_fabrication_prevue", None):
			continue
		if getattr(row, "date_livraison", None):
			row.date_fabrication_prevue = row.date_livraison
			continue
		ligne = _first_ligne_for_article(doc, row.article) if row.article else None
		ref = getattr(ligne, "date_livraison_commande", None) if ligne else None
		if ref:
			row.date_livraison = ref
			row.date_fabrication_prevue = ref
			continue
		fallback = getdate(today())
		row.date_fabrication_prevue = fallback
		if not getattr(row, "date_livraison", None):
			row.date_livraison = fallback


def create_dossier_from_sales_order(doc) -> str | None:
	"""
	Crée un Dossier Fabrication pour la commande si absent.
	Retourne le nom du dossier ou None si création impossible / déjà existant.
	`doc` doit être un Sales Order (Document ou dict avec items).
	"""
	so_name = doc.name
	existing = frappe.db.exists("Dossier Fabrication", {"sales_order": so_name})
	if existing:
		return str(existing)

	if not getattr(doc, "custom_demande_de_faisabilité", None):
		frappe.log_error(
			f"Pas de demande de faisabilité pour commande {so_name}",
			"create_dossier_from_sales_order",
		)
		return None

	feasibility_request_id = doc.custom_demande_de_faisabilité
	feasibility_studies = frappe.get_all(
		"Etude Faisabilite",
		filters={"demande_faisabilite": feasibility_request_id, "status": "Réalisable"},
		fields=["name", "trace", "imposition", "machine_prevue"],
	)
	study = _pick_feasibility_study(feasibility_studies)
	if not study:
		frappe.log_error(
			f"Aucune étude faisabilité réalisable avec trace/imposition pour {feasibility_request_id}",
			"create_dossier_from_sales_order",
		)
		return None

	maquettes_data = _maquettes_map_for_sales_order(so_name)
	delivery_dates_by_item = _sales_order_delivery_dates_by_item(doc)
	has_delivery_date_field = _dossier_ligne_has_delivery_date_field()

	dossier = frappe.new_doc("Dossier Fabrication")
	dossier.naming_series = DOSSIER_FABRICATION_NAMING_SERIES
	dossier.sales_order = so_name
	dossier.client = doc.customer
	dossier.demande_faisabilite = feasibility_request_id
	dossier.quotation = getattr(doc, "custom_devis", None) or None
	dossier.niveau_urgence = _niveau_urgence_pour_dossier(doc, feasibility_request_id)
	dossier.status = "Ouvert"

	for item in doc.items:
		row = dossier.append("lignes", {})
		row.article = item.item_code
		row.quantite_commandee = flt(item.qty)
		if has_delivery_date_field:
			row.date_livraison_commande = delivery_dates_by_item.get(item.item_code)
		row.bat = _latest_bat_for_item(item.item_code)
		if item.item_code in maquettes_data:
			row.maquette = maquettes_data[item.item_code]
		row.trace = study.get("trace")
		row.imposition = study.get("imposition")
		row.etude_faisabilite = study.get("name")
		if study.get("machine_prevue"):
			row.machine = study["machine_prevue"]

	dossier.flags.ignore_permissions = True
	dossier.insert()
	return dossier.name


def create_dossier_fabrication_on_submit(doc, method=None):
	"""Hook Sales Order on_submit — crée le dossier sans générer les études techniques."""
	try:
		had_before = frappe.db.exists("Dossier Fabrication", {"sales_order": doc.name})
		name = create_dossier_from_sales_order(doc)
		if name and not had_before:
			frappe.msgprint(
				_("Dossier fabrication {0} créé.").format(name),
				indicator="green",
				title=_("Dossier fabrication"),
			)
	except Exception as e:
		frappe.log_error(
			f"Échec création dossier fabrication pour {doc.name}: {e}",
			"create_dossier_fabrication_on_submit",
		)
		frappe.msgprint(
			_("Attention : impossible de créer le dossier fabrication automatiquement. Créez-le ou complétez les données."),
			indicator="orange",
			title=_("Avertissement"),
		)


def _date_for_sort(val):
	"""Uniformise une valeur date (str depuis le formulaire/API ou date DB) pour tri ou comparaison."""
	if not val:
		return datetime.date.min
	if isinstance(val, datetime.datetime):
		return val.date()
	if isinstance(val, datetime.date):
		return val
	return getdate(val)


def _badge_style_for_color(color: str | None) -> str:
	"""Style clair aligné sur les couleurs de statut Frappe/DocType."""
	styles = {
		"blue": ("rgba(17, 138, 178, 0.1)", "#118ab2"),
		"yellow": ("rgba(255, 193, 7, 0.15)", "#856404"),
		"green": ("rgba(40, 167, 69, 0.1)", "#28a745"),
		"orange": ("rgba(244, 162, 97, 0.12)", "#e76f51"),
		"red": ("rgba(230, 57, 70, 0.1)", "#e63946"),
		"gray": ("rgba(108, 117, 125, 0.1)", "#6c757d"),
		"grey": ("rgba(108, 117, 125, 0.1)", "#6c757d"),
	}
	bg, fg = styles.get((color or "gray").lower(), styles["gray"])
	return f"background:{bg}; color:{fg};"


def _etude_technique_status_color(status: str | None) -> str | None:
	status = (status or "").strip()
	if not status:
		return None
	colors_by_status = {
		state.title: state.color
		for state in (frappe.get_meta("Etude Technique").get("states") or [])
		if getattr(state, "title", None)
	}
	# Certains flux écrivent "Terminé" alors que la méta peut contenir "Terminée".
	if "Terminé" not in colors_by_status and "Terminée" in colors_by_status:
		colors_by_status["Terminé"] = colors_by_status["Terminée"]
	if "Annulé" not in colors_by_status and "Annulée" in colors_by_status:
		colors_by_status["Annulé"] = colors_by_status["Annulée"]
	return colors_by_status.get(status)


def _item_names_map(articles: set[str]) -> dict[str, str]:
	if not articles:
		return {}
	return {
		row.name: row.item_name or row.name
		for row in frappe.get_all(
			"Item",
			filters={"name": ["in", list(articles)]},
			fields=["name", "item_name"],
		)
	}


def _programme_sort_date(row) -> datetime.date:
	fab = getattr(row, "date_fabrication_prevue", None)
	if fab:
		return _date_for_sort(fab)
	return _date_for_sort(getattr(row, "date_livraison", None))


def build_dossier_apercu_context(doc: Document) -> dict:
	"""Contexte Jinja pour la synthèse articles / programme livraison."""
	if not doc.sales_order:
		return {"no_sales_order": True}

	articles: set[str] = set()
	for ln in doc.get("lignes") or []:
		if ln.article:
			articles.add(ln.article)
	for pr in doc.get("programme_livraison") or []:
		if pr.article:
			articles.add(pr.article)
	item_names = _item_names_map(articles)

	recap_rows: list[dict] = []
	total_cmd = 0.0
	total_prog = 0.0
	for ln in doc.get("lignes") or []:
		if not ln.article:
			continue
		q_cmd = flt(ln.quantite_commandee)
		q_prog = flt(ln.quantite_programmee or 0)
		q_prod = flt(ln.quantite_produite or 0)
		base = q_cmd if q_cmd > 0 else q_prog
		pct = round((q_prod / base) * 100, 1) if base and base > 0 else 0
		total_cmd += q_cmd
		total_prog += q_prog
		recap_rows.append(
			{
				"article": ln.article,
				"designation": ln.designation_article or item_names.get(ln.article, ""),
				"q_cmd": f"{q_cmd:g}",
				"q_prog": f"{q_prog:g}",
				"q_prod": f"{q_prod:g}",
				"pct": pct,
				"r_prog": f"{flt(ln.quantite_restante_a_programmer or 0):g}",
				"r_prod": f"{flt(ln.quantite_restante_a_produire or 0):g}",
				"statut": ln.statut_article or "",
			}
		)

	pct_programme = round((total_prog / total_cmd) * 100, 1) if total_cmd > 0 else 0
	if pct_programme <= 0:
		pct_programme_class = "df-title-pct-red"
	elif pct_programme >= 100:
		pct_programme_class = "df-title-pct-green"
	else:
		pct_programme_class = "df-title-pct-orange"

	prog = list(doc.get("programme_livraison") or [])
	prog.sort(key=lambda r: (_programme_sort_date(r), r.idx or 0))

	etude_names = [pr.etude_technique for pr in prog if pr.etude_technique]
	etude_status_by_name: dict[str, str] = {}
	if etude_names:
		for etude in frappe.get_all(
			"Etude Technique",
			filters={"name": ["in", etude_names]},
			fields=["name", "status"],
		):
			etude_status_by_name[etude.name] = etude.status

	programme_rows: list[dict] = []
	for pr in prog:
		q_prog_line = flt(pr.quantite_a_produire)
		q_prod_line = flt(pr.quantite_produite or 0)
		pct_line = round((q_prod_line / q_prog_line) * 100, 1) if q_prog_line > 0 else 0
		fab_val = getattr(pr, "date_fabrication_prevue", None)
		try:
			fab_iso = getdate(fab_val).strftime("%Y-%m-%d") if fab_val else ""
		except Exception:
			fab_iso = ""

		row_ctx: dict = {
			"article": pr.article or "",
			"designation": pr.designation_article or item_names.get(pr.article or "", ""),
			"machine": pr.machine or "",
			"date_fabrication": formatdate(fab_val) if fab_val else "",
			"date_fabrication_iso": fab_iso,
			"programme_row_name": pr.name or "",
			"date_livraison": formatdate(pr.date_livraison) if pr.date_livraison else "",
			"q_prog": f"{q_prog_line:g}",
			"q_prod": f"{q_prod_line:g}",
			"pct": pct_line,
			"pct_width": min(max(pct_line, 0), 100),
			"etude_technique": pr.etude_technique or "",
		}
		if pr.etude_technique:
			etude_status = etude_status_by_name.get(pr.etude_technique) or _("Non créée")
			row_ctx["etude_status"] = etude_status
			row_ctx["etude_url"] = get_url_to_form("Etude Technique", pr.etude_technique)
			row_ctx["etude_badge_style"] = _badge_style_for_color(
				_etude_technique_status_color(etude_status) or "gray"
			)
		programme_rows.append(row_ctx)

	return {
		"no_sales_order": False,
		"dossier_name": doc.name,
		"planification_validee": _is_planification_locked(doc),
		"recap_rows": recap_rows,
		"programme_rows": programme_rows,
		"pct_programme": pct_programme,
		"pct_programme_class": pct_programme_class,
	}


def build_dossier_apercu_html(doc: Document) -> str:
	"""Rendu Jinja de la synthèse (affichage Desk uniquement, non persisté)."""
	context = build_dossier_apercu_context(doc)
	if context.get("no_sales_order"):
		return f"<p class='text-muted'>{_('Pas de commande liée.')}</p>"
	return frappe.render_template(DOSSIER_APERCU_TEMPLATE, context, is_path=True)


class DossierFabrication(Document):
	def before_insert(self):
		# Avant set_new_name() : si la méta en base ou le défaut client envoient encore DF-.YYYY.-, le nom serait faux.
		ns = (self.naming_series or "").strip()
		if not ns or ns == "DF-.YYYY.-":
			self.naming_series = DOSSIER_FABRICATION_NAMING_SERIES

	def validate(self):
		_sync_ligne_delivery_dates_from_sales_order(self)
		_ensure_programme_date_fabrication_prevue(self)
		_sync_statuts_programme(self)
		_sync_ligne_aggregates_from_programme(self)
		_sync_passages(self)

	@frappe.whitelist()
	def get_dossier_apercu_html(self):
		"""Retourne l'aperçu HTML pour le champ HTML du formulaire (non persisté)."""
		self.check_permission("read")
		_sync_ligne_delivery_dates_from_sales_order(self)
		_sync_statuts_programme(self)
		_sync_ligne_aggregates_from_programme(self)
		return build_dossier_apercu_html(self)


@frappe.whitelist()
def add_programme_livraison(
	dossier_name: str,
	article: str,
	date_livraison: str,
	date_fabrication_prevue: str,
	quantite_a_produire,
	bat: str | None = None,
	machine: str | None = None,
	allow_overflow: int | str = 0,
):
	"""Ajoute une ligne dans programme_livraison avec défauts issus de la ligne article."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	dossier.check_permission("write")
	_ensure_planification_editable(dossier)
	ligne = _first_ligne_for_article(dossier, article)
	if not ligne:
		frappe.throw(_("Article introuvable dans les lignes du dossier."))

	selected_machine = (machine or "").strip() or ligne.machine
	_validate_offset_machine(selected_machine or None)

	tot_cmd = _totaux_commandes_par_article(dossier).get(article, 0)
	already = sum(
		flt(r.quantite_a_produire)
		for r in dossier.programme_livraison
		if r.article == article
	)
	new_q = flt(quantite_a_produire)
	if not cint(allow_overflow) and already + new_q > tot_cmd + 1e-6:
		frappe.throw(
			_("Quantité trop importante : restant à programmer {0} (commandé {1}, déjà programmé {2}).").format(
				max(tot_cmd - already, 0),
				tot_cmd,
				already,
			)
		)

	row = dossier.append("programme_livraison", {})
	row.article = article
	row.quantite_a_produire = new_q
	row.date_livraison = date_livraison
	row.date_fabrication_prevue = date_fabrication_prevue
	row.bat = bat or _latest_bat_for_item(article) or ligne.bat
	row.maquette = ligne.maquette
	row.trace = ligne.trace
	row.imposition = ligne.imposition
	row.machine = selected_machine
	row.etude_faisabilite = ligne.etude_faisabilite
	row.quantite_produite = 0
	row.statut = "Planifié"

	dossier.save(ignore_permissions=True)
	return {"name": dossier.name, "programme_row_name": row.name}


@frappe.whitelist()
def update_programme_date_fabrication_prevue(
	dossier_name: str,
	programme_row_name: str,
	date_fabrication_prevue: str,
):
	"""Met à jour la date fabrication prévue d'une ligne programme depuis l'aperçu HTML ; synchronise l'étude technique liée."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	dossier.check_permission("write")
	target = _programme_row_for_name(dossier, programme_row_name)
	if not target:
		frappe.throw(_("Ligne programme introuvable."))
	if not date_fabrication_prevue:
		frappe.throw(_("La date de fabrication prévue est obligatoire."))

	target.date_fabrication_prevue = getdate(date_fabrication_prevue)
	_sync_etude_technique_planning_from_programme_row(target)

	dossier.save()
	return {"ok": 1}


@frappe.whitelist()
def update_programme_machine(
	dossier_name: str,
	programme_row_name: str,
	machine: str | None = None,
):
	"""Met à jour la machine d'une ligne programme ; synchronise l'étude technique liée."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	dossier.check_permission("write")
	target = _programme_row_for_name(dossier, programme_row_name)
	if not target:
		frappe.throw(_("Ligne programme introuvable."))

	m = (machine or "").strip() or None
	_validate_offset_machine(m)
	target.machine = m
	_sync_etude_technique_planning_from_programme_row(target)

	dossier.save()
	return {"ok": 1}


def _create_etude_for_programme_row(dossier: Document, row) -> str:
	"""Crée une Étude Technique pour une ligne programme et retourne son nom."""
	if row.etude_technique:
		frappe.throw(_("Une étude technique existe déjà pour cette ligne programme."))

	ligne = _first_ligne_for_article(dossier, row.article)
	trace = row.trace or (ligne.trace if ligne else None)
	imposition = row.imposition or (ligne.imposition if ligne else None)
	if not trace or not imposition:
		frappe.throw(_("Tracé et imposition sont obligatoires (ligne programme ou référence article)."))

	sales_order_name = dossier.sales_order
	so = frappe.get_doc("Sales Order", sales_order_name)

	due_date = datetime.datetime.now() + datetime.timedelta(days=1)

	technical_study = frappe.new_doc("Etude Technique")
	technical_study.sales_order = sales_order_name
	technical_study.item_code = row.article
	it_name = frappe.db.get_value("Item", row.article, "item_name")
	technical_study.item_name = it_name
	technical_study.qty = row.quantite_a_produire

	technical_study.client = dossier.client
	technical_study.date_echeance = due_date.strftime("%Y-%m-%d")
	technical_study.article = row.article
	technical_study.quantite = int(round(flt(row.quantite_a_produire)))

	if row.bat:
		technical_study.bat = row.bat

	technical_study.commande = sales_order_name
	technical_study.demande_faisabilite = dossier.demande_faisabilite
	technical_study.niveau_urgence = _niveau_urgence_pour_dossier(so, dossier.demande_faisabilite)

	if dossier.quotation:
		technical_study.devis = dossier.quotation

	retirage = getattr(so, "custom_retirage", None)
	if retirage is not None:
		technical_study.is_reprint = retirage
	else:
		technical_study.is_reprint = 0

	if row.maquette:
		technical_study.maquette = row.maquette

	technical_study.trace = trace
	technical_study.imposition = imposition
	_et_meta = frappe.get_meta("Etude Technique")
	if _et_meta.has_field("etude_faisabilite") and row.etude_faisabilite:
		technical_study.etude_faisabilite = row.etude_faisabilite
	if row.machine:
		technical_study.machine = row.machine

	technical_study.dossier_fabrication = dossier.name
	technical_study.ligne_dossier_fabrication = row.name

	if row.date_livraison:
		technical_study.date_livraison = row.date_livraison

	if getattr(row, "date_fabrication_prevue", None) and _et_meta.has_field(
		"date_planification_production"
	):
		technical_study.date_planification_production = row.date_fabrication_prevue

	technical_study.insert(ignore_permissions=True)

	row.etude_technique = technical_study.name
	return technical_study.name


@frappe.whitelist()
def create_etude_technique_from_programme_line(dossier_name: str, programme_idx: int):
	"""Crée une Étude Technique pour la ligne programme d'index 1..n."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	dossier.check_permission("write")
	idx = cint(programme_idx)
	prog = dossier.get("programme_livraison") or []
	if idx < 1 or idx > len(prog):
		frappe.throw(_("Numéro de ligne programme invalide."))

	row = prog[idx - 1]
	name = _create_etude_for_programme_row(dossier, row)
	dossier.save(ignore_permissions=True)

	return {"name": name}


@frappe.whitelist()
def valider_planification(dossier_name: str):
	"""Valide la planification : génère toutes les études techniques et verrouille le programme."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	dossier.check_permission("write")
	if _is_planification_locked(dossier):
		frappe.throw(_("La planification est déjà validée pour ce dossier."))

	prog = dossier.get("programme_livraison") or []
	if not prog:
		frappe.throw(_("Aucune ligne dans le programme livraison à valider."))

	errors: list[str] = []
	for idx, row in enumerate(prog, start=1):
		label = row.article or _("ligne {0}").format(idx)
		if not row.machine:
			errors.append(_("{0} : machine obligatoire.").format(label))
		if not getattr(row, "date_fabrication_prevue", None):
			errors.append(_("{0} : date de fabrication prévue obligatoire.").format(label))
		ligne = _first_ligne_for_article(dossier, row.article) if row.article else None
		trace = row.trace or (ligne.trace if ligne else None)
		imposition = row.imposition or (ligne.imposition if ligne else None)
		if not trace or not imposition:
			errors.append(_("{0} : tracé et imposition obligatoires.").format(label))

	if errors:
		frappe.throw(
			"<br>".join(errors),
			title=_("Planification incomplète"),
		)

	created: list[str] = []
	for row in prog:
		if row.etude_technique:
			continue
		created.append(_create_etude_for_programme_row(dossier, row))

	dossier.planification_validee = 1
	dossier.date_validation_planification = now()
	dossier.valide_par = frappe.session.user
	dossier.status = "En cours"
	_sync_statuts_programme(dossier)
	_sync_ligne_aggregates_from_programme(dossier)
	dossier.save(ignore_permissions=True)

	frappe.msgprint(
		_("Planification validée. {0} étude(s) technique(s) créée(s).").format(len(created)),
		indicator="green",
		title=_("Planification validée"),
	)
	return {"ok": 1, "created_count": len(created), "created": created}


@frappe.whitelist()
def clear_programme_livraison(dossier_name: str):
	"""Supprime toutes les lignes du programme et retire le lien dossier sur les études techniques liées."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	dossier.check_permission("write")
	_ensure_planification_editable(dossier)

	for row in list(dossier.programme_livraison or []):
		if row.etude_technique and frappe.db.exists("Etude Technique", row.etude_technique):
			et = frappe.get_doc("Etude Technique", row.etude_technique)
			et.dossier_fabrication = None
			et.ligne_dossier_fabrication = None
			et.save(ignore_permissions=True)

	dossier.reload()
	dossier.programme_livraison = []
	dossier.save()

	return {"ok": 1}

