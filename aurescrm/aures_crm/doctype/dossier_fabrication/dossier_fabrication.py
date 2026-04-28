# Copyright (c) 2026, AURES Technologies and contributors
# For license information, please see license.txt

from __future__ import annotations

import datetime
from collections import defaultdict

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt, formatdate, get_url_to_form, getdate
from frappe.utils.data import escape_html

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


def build_dossier_apercu_html(doc: Document) -> str:
	"""Synthèse HTML : récap par article + détail du programme livraison."""
	if not doc.sales_order:
		return "<p class='text-muted'>Pas de commande liée.</p>"

	style = """
<style>
.dossier-apercu { font-size:12px; }
.dossier-apercu table { background:var(--card-bg); border:1px solid var(--border-color); border-collapse:separate; border-radius:10px; border-spacing:0; margin-bottom:1rem; overflow:hidden; table-layout:auto; width:100%; }
.dossier-apercu th, .dossier-apercu td { border-bottom:1px solid var(--border-color); padding:10px 12px; vertical-align:middle; }
.dossier-apercu tbody tr:last-child td { border-bottom:0; }
.dossier-apercu th { background:#f4f5f6; color: var(--text-muted); font-weight:700; text-align:left; white-space:nowrap; }
.dossier-apercu th:first-child { border-top-left-radius:10px; }
.dossier-apercu th:last-child { border-top-right-radius:10px; }
.dossier-apercu h4 { margin: 1rem 0 0.5rem 0; font-size: 13px; }
.dossier-apercu .df-muted { color: var(--text-muted); font-size:11px; }
.dossier-apercu .df-link { font-weight:600; }
.dossier-apercu .df-article-code { font-weight:700; white-space:nowrap; word-break:normal; }
.dossier-apercu .df-designation { color: var(--text-muted); font-size:11px; white-space:nowrap; }
.dossier-apercu .df-number { text-align:right; white-space:nowrap; }
.dossier-apercu .df-date { white-space:nowrap; }
.dossier-apercu .df-badge { border-radius:999px; display:inline-block; font-size:11px; font-weight:600; line-height:1; margin-top:4px; padding:4px 8px; }
.dossier-apercu .df-progress { background:#edf0f2; border-radius:999px; height:9px; margin-top:6px; overflow:hidden; width:100%; }
.dossier-apercu .df-progress-bar { background:#22c55e; border-radius:999px; height:100%; min-width:0; }
.dossier-apercu .df-progress-cell { min-width:150px; }
.dossier-apercu .df-study-cell { min-width:155px; }
.dossier-apercu .df-study-inline { align-items:center; display:flex; gap:8px; white-space:nowrap; }
.dossier-apercu .df-title-row { align-items:center; display:flex; justify-content:space-between; margin:1rem 0 0.5rem 0; }
.dossier-apercu .df-title-row h4 { margin:0; }
.dossier-apercu .df-title-pct { border-radius:999px; display:inline-block; font-size:12px; font-weight:700; padding:4px 9px; }
.dossier-apercu .df-title-pct-red { background:#ffe8e8; color:#c53030; }
.dossier-apercu .df-title-pct-orange { background:#fff3d6; color:#9a6700; }
.dossier-apercu .df-title-pct-green { background:#e7f7ee; color:#16794c; }
</style>
"""

	# --- Récap articles (lignes après agrégation)
	recap_rows = ""
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
		r_prog = flt(ln.quantite_restante_a_programmer or 0)
		r_prod = flt(ln.quantite_restante_a_produire or 0)
		total_cmd += q_cmd
		total_prog += q_prog
		name_art = escape_html(ln.designation_article or frappe.db.get_value("Item", ln.article, "item_name") or "")
		recap_rows += f"""<tr>
<td><span class="df-article-code">{escape_html(ln.article)}</span></td>
<td><span class="df-designation">{name_art}</span></td>
<td class="df-number">{q_cmd:g}</td>
<td class="df-number">{q_prog:g}</td>
<td class="df-number">{q_prod:g}</td>
<td class="df-number">{pct}%</td>
<td class="df-number">{r_prog:g}</td>
<td class="df-number">{r_prod:g}</td>
<td>{escape_html(ln.statut_article or "")}</td>
</tr>"""

	recap_block = f"""
<h4>{escape_html(_("Récapitulatif par article"))}</h4>
<table>
<thead><tr>
<th>{escape_html(_("Article"))}</th>
<th>{escape_html(_("Désignation"))}</th>
<th class="df-number">{escape_html(_("Q. commandée"))}</th>
<th class="df-number">{escape_html(_("Q. programmée"))}</th>
<th class="df-number">{escape_html(_("Q. produite"))}</th>
<th class="df-number">{escape_html(_("% produit"))}</th>
<th class="df-number">{escape_html(_("Reste prog."))}</th>
<th class="df-number">{escape_html(_("Reste prod."))}</th>
<th>{escape_html(_("Statut"))}</th>
</tr></thead>
<tbody>{recap_rows or f'<tr><td colspan="9">{escape_html(_("Aucune ligne article."))}</td></tr>'}</tbody>
</table>
"""
	pct_programme = round((total_prog / total_cmd) * 100, 1) if total_cmd > 0 else 0
	if pct_programme <= 0:
		pct_programme_class = "df-title-pct-red"
	elif pct_programme >= 100:
		pct_programme_class = "df-title-pct-green"
	else:
		pct_programme_class = "df-title-pct-orange"

	# --- Détail programme livraison (tri par date)
	prog = list(doc.get("programme_livraison") or [])
	prog.sort(key=lambda r: (_date_for_sort(r.date_livraison), r.idx or 0))
	etude_names = [pr.etude_technique for pr in prog if pr.etude_technique]
	etude_status_by_name = {}
	if etude_names:
		for etude in frappe.get_all(
			"Etude Technique",
			filters={"name": ["in", etude_names]},
			fields=["name", "status"],
		):
			etude_status_by_name[etude.name] = etude.status

	detail_rows = ""
	for pr in prog:
		q_prog_line = flt(pr.quantite_a_produire)
		q_prod_line = flt(pr.quantite_produite or 0)
		pct_line = round((q_prod_line / q_prog_line) * 100, 1) if q_prog_line > 0 else 0
		pct_width = min(max(pct_line, 0), 100)
		if pr.etude_technique:
			etude_status = etude_status_by_name.get(pr.etude_technique) or _("Non créée")
			badge_style = _badge_style_for_color(_etude_technique_status_color(etude_status) or "gray")
			etude_link = f"""
<a class="df-link" href="{escape_html(get_url_to_form('Etude Technique', pr.etude_technique))}">
{escape_html(pr.etude_technique)}
</a>
"""
			badge_html = (
				f'<span class="df-badge" style="{badge_style}">{escape_html(etude_status)}</span>'
			)
		else:
			etude_link = ""
			badge_html = ""
		if pr.designation_article:
			designation = escape_html(pr.designation_article)
		elif pr.article:
			designation = escape_html(frappe.db.get_value("Item", pr.article, "item_name") or "")
		else:
			designation = ""
		dl = escape_html(formatdate(pr.date_livraison) if pr.date_livraison else "")
		detail_rows += f"""<tr>
<td><span class="df-article-code">{escape_html(pr.article or "")}</span></td>
<td><span class="df-designation">{designation}</span></td>
<td class="df-date">{dl}</td>
<td class="df-number">{q_prog_line:g}</td>
<td class="df-progress-cell">
	<div><strong>{q_prod_line:g}</strong> / {q_prog_line:g} <span class="df-muted">({pct_line:g}%)</span></div>
	<div class="df-progress"><div class="df-progress-bar" style="width:{pct_width:g}%"></div></div>
</td>
<td class="df-study-cell">
	<div class="df-study-inline">
		{etude_link}{badge_html}
	</div>
</td>
</tr>"""

	detail_block = f"""
<div class="df-title-row">
	<h4>{escape_html(_("Programme livraison"))}</h4>
	<span class="df-title-pct {pct_programme_class}">{pct_programme:g}%</span>
</div>
<table>
<thead><tr>
<th>{escape_html(_("Article"))}</th>
<th>{escape_html(_("Désignation"))}</th>
<th>{escape_html(_("Date livraison"))}</th>
<th class="df-number">{escape_html(_("Q. programmée"))}</th>
<th>{escape_html(_("Q. produite"))}</th>
<th>{escape_html(_("Étude liée"))}</th>
</tr></thead>
<tbody>{detail_rows or f'<tr><td colspan="6">{escape_html(_("Aucune ligne de programme."))}</td></tr>'}</tbody>
</table>
"""

	return f'<div class="dossier-apercu" style="overflow-x:auto">{style}{recap_block}{detail_block}</div>'


class DossierFabrication(Document):
	def before_insert(self):
		# Avant set_new_name() : si la méta en base ou le défaut client envoient encore DF-.YYYY.-, le nom serait faux.
		ns = (self.naming_series or "").strip()
		if not ns or ns == "DF-.YYYY.-":
			self.naming_series = DOSSIER_FABRICATION_NAMING_SERIES

	def validate(self):
		_sync_ligne_delivery_dates_from_sales_order(self)
		_sync_statuts_programme(self)
		_sync_ligne_aggregates_from_programme(self)
		self.html_apercu = build_dossier_apercu_html(self)


@frappe.whitelist()
def get_dossier_apercu_html(dossier_name: str) -> str:
	"""Retourne l'aperçu HTML à afficher dans le champ HTML du formulaire."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	dossier.check_permission("read")
	_sync_ligne_delivery_dates_from_sales_order(dossier)
	_sync_statuts_programme(dossier)
	_sync_ligne_aggregates_from_programme(dossier)
	return build_dossier_apercu_html(dossier)


@frappe.whitelist()
def add_programme_livraison(
	dossier_name: str,
	article: str,
	date_livraison: str,
	quantite_a_produire,
	bat: str | None = None,
	allow_overflow: int | str = 0,
):
	"""Ajoute une ligne dans programme_livraison avec défauts issus de la ligne article."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	ligne = _first_ligne_for_article(dossier, article)
	if not ligne:
		frappe.throw(_("Article introuvable dans les lignes du dossier."))

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
	row.bat = bat or _latest_bat_for_item(article) or ligne.bat
	row.maquette = ligne.maquette
	row.trace = ligne.trace
	row.imposition = ligne.imposition
	row.machine = ligne.machine
	row.etude_faisabilite = ligne.etude_faisabilite
	row.quantite_produite = 0
	row.statut = "Planifié"

	dossier.save(ignore_permissions=True)
	return {"name": dossier.name, "programme_row_name": row.name}


@frappe.whitelist()
def create_etude_technique_from_programme_line(dossier_name: str, programme_idx: int):
	"""Crée une Étude Technique pour la ligne programme d'index 1..n."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	idx = cint(programme_idx)
	prog = dossier.get("programme_livraison") or []
	if idx < 1 or idx > len(prog):
		frappe.throw(_("Numéro de ligne programme invalide."))

	row = prog[idx - 1]
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

	technical_study.insert(ignore_permissions=True)

	row.etude_technique = technical_study.name
	dossier.save(ignore_permissions=True)

	return {"name": technical_study.name}


@frappe.whitelist()
def clear_programme_livraison(dossier_name: str):
	"""Supprime toutes les lignes du programme et retire le lien dossier sur les études techniques liées."""
	dossier = frappe.get_doc("Dossier Fabrication", dossier_name)
	dossier.check_permission("write")

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

