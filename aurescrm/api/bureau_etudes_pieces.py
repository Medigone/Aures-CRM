# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Pièces d'une étude sur le poste de bureau : tracé, imposition, machine, et en Flexo plan, maquette et cliché.

Chaque écriture passe par les droits Frappe de la pièce et par la sauvegarde de l'étude : ses `before_save` et son
`validate` restent seuls à calculer format de la presse, passages, charge et nombre de feuilles.
Le circuit de la maquette et du cliché reste sur le Desk : on y montre le statut et on crée le cliché, sans plus.
"""

import json
import os
import re

import frappe
from frappe import _
from frappe.model.workflow import get_workflow_name
from frappe.utils import cint, cstr, escape_html, flt

from aurescrm import item_cotations
from aurescrm.api.bureau import require_bureau
from aurescrm.api.bureau_etudes import FLEXO, OFFSET, _etude_for_action, _resolve, condition_fields, get_etude
from aurescrm.aures_crm.doctype.etude_faisabilite.etude_faisabilite import compute_nbr_feuilles, get_machines_for_etude_selection
from aurescrm.aures_crm.doctype.trace.trace import duplicate_trace_from_reference
from aurescrm.passages import get_passages_pour_machine

IN_STUDY = "En étude"
CLOSED_FOR_MACHINE = ("Nouveau", "Annulée")
MACHINE_OK = "Operationnelle"
DIMENSION = re.compile(r"^\d+(?:\.\d+)?x\d+(?:\.\d+)?$")
LENGTH = re.compile(r"^\d+(?:\.\d+)?$")
SHEET = re.compile(r"(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)", re.I)
# Fichier d'une pièce : son document, son champ, et le champ de l'étude qui le recopie.
FILES = {
	"trace": ("Trace", "fichier_trace", "fichier_trace"),
	"imposition": ("Imposition", "fichier_imp", "fichier_imp"),
	"plan_flexo": ("Plan Flexo", "fichier", "fichier_plan_flexo"),
}


def _file(url):
	return {"url": url, "name": os.path.basename(cstr(url).rstrip("/"))} if url else None


def sheet_size(imposition):
	"""Laize et développement en mm : les champs calculés, ou à défaut le format saisi à la main."""
	laize, developpement = flt(imposition.get("format_laize")), flt(imposition.get("format_developpement"))
	if laize and developpement:
		return laize, developpement
	found = SHEET.search(cstr(imposition.get("format_imp")))
	if not found:
		return 0, 0
	return flt(found.group(1).replace(",", ".")), flt(found.group(2).replace(",", "."))


def machine_alerts(machine, imposition, feuilles):
	"""Les contrôles du Desk. Aucun n'empêche de choisir : `red` pour ce qui ne passe pas sur la presse, `amber` pour ce qui reste à vérifier."""
	alerts = []
	status = cstr(machine.get("status"))
	if status and status != MACHINE_OK:
		alerts.append({"tone": "amber", "text": _("Presse {0} à ce jour.").format(status.lower())})
	if not imposition:
		return alerts
	laize, developpement = sheet_size(imposition)
	max_laize, max_developpement = flt(machine.get("format_max_laize")), flt(machine.get("format_max_developpement"))
	if laize and max_laize and laize > max_laize:
		alerts.append({"tone": "red", "text": _("La laize de l'imposition ({0} mm) dépasse le format max de la presse ({1} mm).").format(_mm(laize), _mm(max_laize))})
	if developpement and max_developpement and developpement > max_developpement:
		alerts.append({"tone": "red", "text": _("Le développement de l'imposition ({0} mm) dépasse le format max de la presse ({1} mm).").format(_mm(developpement), _mm(max_developpement))})
	minimum = cint(machine.get("min_qt"))
	if feuilles and minimum and feuilles < minimum:
		alerts.append({"tone": "amber", "text": _("Nombre de feuilles ({0}) sous le minimum de la presse ({1}).").format(cint(feuilles), minimum)})
	return alerts


def _mm(value):
	return f"{flt(value):g}".replace(".", ",")


def _sheet_label(imposition):
	laize, developpement = sheet_size(imposition)
	return f"{_mm(laize)} × {_mm(developpement)}" if laize and developpement else cstr(imposition.get("format_imp")) or None


def _read(doctype, name, fields):
	"""La pièce si ce rôle la lit. Sinon son seul numéro : l'étude le porte déjà."""
	if not name:
		return None
	row = frappe.db.get_value(doctype, name, fields, as_dict=True) if frappe.has_permission(doctype, "read") else None
	return {"name": name, **(row or {})}


def _work(doc):
	return bool(doc.has_permission("write")) and doc.status == IN_STUDY


def _trace_piece(doc, work):
	name = doc.trace
	linked = bool(name)
	if not name:
		name = frappe.db.get_value("Trace", {"article": doc.article}, "name")
	row = _read("Trace", name, ["dimensions", "points_colle", "fichier_trace"])
	piece = {"can_edit": work and bool(frappe.has_permission("Trace", "write")), "can_create": work and bool(frappe.has_permission("Trace", "create")), "linked": linked}
	if not row:
		return {**piece, "name": None}
	ecart = False
	if linked and doc.doctype == OFFSET and row.get("dimensions") is not None:
		ecart = item_cotations.trace_cotations_differ_from_item(name, doc.article)["show_warning"]
	return {**piece, "name": name, "dimensions": row.get("dimensions"), "points_colle": cint(row.get("points_colle")), "fichier": _file(row.get("fichier_trace")), "ecart": ecart}


IMPOSITION_FIELDS = ["name", "format_imp", "nbr_poses", "taux_chutes", "defaut", "origine_calcul", "format_laize", "format_developpement", "fichier_imp", "laize_pal", "format_laize_palette", "n_col", "n_rang", "rotation", "pas_laize", "pas_depl", "calcul_imposition"]


def _imposition_row(row, quantite, machine=None):
	feuilles = compute_nbr_feuilles(quantite, cint(row.get("nbr_poses")))
	return {
		"name": row["name"],
		"format": _sheet_label(row),
		"format_imp": row.get("format_imp"),
		"laize_pal": row.get("laize_pal"),
		"format_laize_palette": row.get("format_laize_palette"),
		"nbr_poses": cint(row.get("nbr_poses")),
		"taux_chutes": flt(row.get("taux_chutes")) if row.get("taux_chutes") is not None else None,
		"ideale": bool(row.get("defaut")),
		"origine": row.get("origine_calcul") or "Manuel",
		"calcul": row.get("calcul_imposition"),
		"feuilles": feuilles,
		"fichier": _file(row.get("fichier_imp")),
		"alertes": [alert for alert in machine_alerts(machine, row, feuilles) if alert["tone"] == "red"] if machine else [],
	}


def sheet_drawing(row):
	"""De quoi dessiner la feuille : la silhouette de découpe du calcul, posée selon la grille. None pour une imposition saisie à la main."""
	if not cint(row.get("n_col")) or not cint(row.get("n_rang")) or not row.get("calcul_imposition"):
		return None
	calcul = frappe.db.get_value("Calcul Imposition", row["calcul_imposition"], ["silhouette_svg", "lisiere", "pince"], as_dict=True)
	if not calcul or not calcul.silhouette_svg:
		return None
	try:
		silhouettes = json.loads(calcul.silhouette_svg)
	except (TypeError, ValueError):
		return None
	paths = silhouettes.get(str(cint(row.get("rotation")))) or silhouettes.get("0")
	laize, developpement = sheet_size(row)
	if not paths or not laize or not developpement:
		return None
	return {
		"laize": laize,
		"developpement": developpement,
		"n_col": cint(row["n_col"]),
		"n_rang": cint(row["n_rang"]),
		"pas_laize": flt(row.get("pas_laize")),
		"pas_depl": flt(row.get("pas_depl")),
		"lisiere": flt(calcul.lisiere),
		"pince": flt(calcul.pince),
		"coupe": paths.get("path_coupe"),
		"rainage": paths.get("path_rainage"),
	}


def _impositions_of(doc):
	if not doc.trace or not frappe.has_permission("Imposition", "read"):
		return []
	rows = frappe.get_list("Imposition", filters={"client": doc.client, "article": doc.article, "trace": doc.trace}, fields=IMPOSITION_FIELDS, limit_page_length=0)
	return sorted(rows, key=lambda row: (row.taux_chutes is None, flt(row.taux_chutes)))


def _machine_of(doc):
	if not doc.machine_prevue or not frappe.has_permission("Machine", "read"):
		return None
	return frappe.db.get_value("Machine", doc.machine_prevue, ["name", "status", "format_max_laize", "format_max_developpement", "min_qt", "total_couleurs", "vernis"], as_dict=True)


def _imposition_piece(doc, work):
	rights = {"can_edit": work and bool(frappe.has_permission("Imposition", "write")), "can_create": work and bool(frappe.has_permission("Imposition", "create"))}
	rows = _impositions_of(doc)
	current = None
	if doc.imposition:
		row = frappe.db.get_value("Imposition", doc.imposition, IMPOSITION_FIELDS, as_dict=True) if frappe.has_permission("Imposition", "read") else None
		current = {**_imposition_row(row, doc.quantite), "dessin": sheet_drawing(row)} if row else {"name": doc.imposition}
	return {**rights, "courante": current, "nombre": len(rows), "atelier": rights["can_create"] and bool(frappe.has_permission("Calcul Imposition", "read"))}


def _can_change_machine(doc):
	"""Modifiable une fois conclue, mais Frappe réserve alors l'écriture à qui peut valider : le responsable."""
	if doc.status in CLOSED_FOR_MACHINE or not frappe.has_permission("Machine", "read") or not doc.has_permission("write"):
		return False
	return doc.docstatus == 0 or bool(doc.has_permission("submit"))


def _machine_piece(doc):
	can_change = _can_change_machine(doc)
	piece = {"can_change": can_change, "name": doc.machine_prevue or None}
	if not doc.machine_prevue:
		return piece
	# L'étude porte déjà ce qu'il faut : qui ne lit pas les machines voit le même résumé.
	piece.update(
		status=doc.statut_machine_prevue or None,
		format=_sheet_label({"format_imp": doc.format_machine}) if doc.format_machine else None,
		passages=cint(doc.nb_passages),
		charge=flt(doc.charge_feuilles),
		alertes=[],
		detail=None,
	)
	machine = _machine_of(doc)
	if machine:
		imposition = frappe.db.get_value("Imposition", doc.imposition, ["format_imp", "format_laize", "format_developpement"], as_dict=True) if doc.imposition else None
		piece["alertes"] = machine_alerts(machine, imposition, flt(doc.nbr_feuilles))
		# Le format de la machine a pu changer depuis la dernière sauvegarde de l'étude.
		if machine.format_max_laize and machine.format_max_developpement:
			piece["format"] = f"{_mm(machine.format_max_laize)} × {_mm(machine.format_max_developpement)}"
		piece["detail"] = get_passages_pour_machine(doc.article, doc.machine_prevue).get("detail")
	return piece


def _linked_flexo(doc, fieldname, doctype, fields, existing_filters, work):
	"""Pièce Flexo : celle de l'étude, ou celle que l'article a déjà et que la prochaine sauvegarde liera."""
	linked = bool(doc.get(fieldname))
	name = doc.get(fieldname) or frappe.db.get_value(doctype, {"article": doc.article, **existing_filters}, "name")
	piece = {"linked": linked, "can_edit": work and bool(frappe.has_permission(doctype, "write")), "can_create": work and bool(frappe.has_permission(doctype, "create"))}
	row = _read(doctype, name, fields)
	return {**piece, "name": name or None, **{key: value for key, value in (row or {}).items() if key != "name"}}


def _flexo_pieces(doc, work):
	plan = _linked_flexo(doc, "plan_flexo", "Plan Flexo", ["dimensions", "laize", "sens_der", "fichier"], {}, work)
	plan["fichier"] = _file(plan.get("fichier"))
	maquette = _linked_flexo(doc, "maquette", "Maquette", ["status"], {"status": "Version Activée"}, work)
	cliche = _linked_flexo(doc, "cliche", "Cliche", ["status"], {"version_active": 1}, work)
	return {"plan_flexo": plan, "maquette": maquette, "cliche": cliche}


def required_missing(doc):
	"""Ce que le workflow exige encore pour conclure réalisable, quel que soit le rôle : qui renseigne doit le voir aussi."""
	workflow = get_workflow_name(doc.doctype)
	if not workflow:
		return []
	meta = frappe.get_meta(doc.doctype)
	missing = []
	for transition in frappe.get_doc("Workflow", workflow).transitions:
		if transition.state == doc.status and transition.action == "Réalisable" and transition.condition:
			missing.extend(_(meta.get_label(field)) for field in condition_fields(transition.condition) if not doc.get(field))
	return list(dict.fromkeys(missing))


@frappe.whitelist()
def get_etude_pieces(name):
	"""Le détail des pièces pour la fiche, avec ce que ce rôle peut y faire."""
	require_bureau()
	doctype = _resolve(name)
	doc = frappe.get_doc(doctype, name)
	doc.check_permission("read")
	work = _work(doc)
	payload = {"travail": work, "ouverte": doc.status in ("Nouveau", IN_STUDY), "trace": _trace_piece(doc, work), "manque": required_missing(doc)}
	if doctype == OFFSET:
		item = frappe.get_doc("Item", doc.article)
		payload.update(
			imposition=_imposition_piece(doc, work),
			machine=_machine_piece(doc),
			nbr_feuilles=flt(doc.nbr_feuilles),
			cotations={"valeur": item.get("custom_cotations_article") or None, "origine": item_cotations.cotations_origin(item)},
		)
	else:
		payload.update(_flexo_pieces(doc, work))
	return payload


def _etude_for_work(name, modified):
	doc = _etude_for_action(name, modified)
	doc.check_permission("write")
	if doc.status != IN_STUDY:
		frappe.throw(_("Démarrez l'étude pour renseigner ses pièces.") if doc.status == "Nouveau" else _("Cette étude est conclue : ses pièces ne se modifient plus."))
	return doc


def _result(doc, **extra):
	return {"etude": get_etude(doc.name), "pieces": get_etude_pieces(doc.name), **extra}


def _trace_dimensions(doc, dimensions, confirm_bat):
	"""Dimensions contrôlées. En Offset elles deviennent les cotations de l'article : ce qui viendrait effacer un BAT se confirme d'abord."""
	raw = cstr(dimensions).strip()
	if not raw:
		frappe.throw(_("Indiquez les dimensions du tracé."))
	if doc.doctype != OFFSET:
		return raw, None
	normalized = item_cotations.normalize_cotations_article(raw)
	if not normalized:
		frappe.throw(item_cotations._cotations_format_error())
	confirmation = None if cint(confirm_bat) else item_cotations.bat_confirmation(doc.article, normalized)
	return normalized, confirmation


def _link_trace(doc, trace):
	doc.trace = trace.name
	doc.fichier_trace = trace.fichier_trace
	if doc.doctype == OFFSET:
		doc.points_colle = cint(trace.points_colle)
	doc.save()
	if doc.doctype == OFFSET and trace.dimensions:
		# Conséquence du tracé, que ce rôle a le droit de modifier : elle ne dépend pas de son droit sur l'article.
		item_cotations.apply_cotations_from_user_string(doc.article, trace.dimensions, ignore_permissions=True)


@frappe.whitelist(methods=["POST"])
def save_trace(name, modified, dimensions, points_colle=0, confirm_bat=0):
	"""Crée le tracé de l'article ou met à jour le sien, le lie à l'étude et reporte ses dimensions sur l'article."""
	doc = _etude_for_work(name, modified)
	dimensions, confirmation = _trace_dimensions(doc, dimensions, confirm_bat)
	if confirmation:
		return {"confirmation": confirmation}
	existing = doc.trace or frappe.db.get_value("Trace", {"article": doc.article}, "name")
	trace = frappe.get_doc("Trace", existing) if existing else frappe.new_doc("Trace")
	trace.update({"client": doc.client, "article": doc.article, "procede": doc.procede, "dimensions": dimensions, "points_colle": cint(points_colle)})
	trace.save()
	_link_trace(doc, trace)
	return _result(doc, piece=trace.name)


@frappe.whitelist()
def get_trace_references(name):
	"""Les tracés des autres articles du même client, pour en dupliquer un."""
	require_bureau()
	doc = frappe.get_doc(_resolve(name), name)
	doc.check_permission("read")
	rows = frappe.get_list("Trace", filters={"client": doc.client, "article": ["!=", doc.article]}, fields=["name", "article", "dimensions", "points_colle"], order_by="creation desc", limit_page_length=200)
	labels = dict(frappe.get_all("Item", filters={"name": ["in", [row.article for row in rows]]}, fields=["name", "item_name"], as_list=True))
	return [{**row, "designation": labels.get(row.article) or row.article, "impositions": frappe.db.count("Imposition", {"trace": row.name})} for row in rows]


@frappe.whitelist(methods=["POST"])
def duplicate_trace(name, modified, source, dimensions=None, points_colle=None, with_impositions=0, confirm_bat=0):
	"""Reprend le tracé d'un article voisin du même client, et si demandé ses impositions, dont l'idéale devient celle de l'étude."""
	doc = _etude_for_work(name, modified)
	if doc.trace or frappe.db.exists("Trace", {"article": doc.article}):
		frappe.throw(_("Cet article possède déjà un tracé."))
	reference = frappe.db.get_value("Trace", source, ["article", "dimensions"], as_dict=True)
	if not reference:
		frappe.throw(_("Tracé de référence introuvable."))
	wanted = cstr(dimensions).strip() or reference.dimensions
	wanted, confirmation = _trace_dimensions(doc, wanted, confirm_bat)
	if confirmation:
		return {"confirmation": confirmation}
	with_impositions = cint(with_impositions) if frappe.has_permission("Imposition", "create") else 0
	result = duplicate_trace_from_reference(source, doc.client, doc.article, reference.article, wanted, points_colle, with_impositions)
	if result.get("imposition_ideale"):
		_set_imposition(doc, frappe.get_doc("Imposition", result["imposition_ideale"]))
	_link_trace(doc, frappe.get_doc("Trace", result["name"]))
	return _result(doc, piece=result["name"], fichier_copie=result["file_copied"], impositions=len(result["impositions"]))


def _set_imposition(doc, imposition):
	doc.imposition = imposition.name
	doc.taux_chutes = flt(imposition.taux_chutes)
	doc.fichier_imp = imposition.fichier_imp


@frappe.whitelist()
def get_etude_impositions(name):
	"""Les impositions du tracé de l'étude, le meilleur taux de chutes d'abord."""
	require_bureau()
	doc = frappe.get_doc(OFFSET, name)
	doc.check_permission("read")
	machine = _machine_of(doc)
	return [_imposition_row(row, doc.quantite, machine) for row in _impositions_of(doc)]


@frappe.whitelist(methods=["POST"])
def choose_imposition(name, modified, imposition):
	doc = _etude_for_work(name, modified)
	if not doc.trace:
		frappe.throw(_("Le tracé vient d'abord : l'imposition se calcule à partir de lui."))
	row = frappe.get_doc("Imposition", imposition)
	row.check_permission("read")
	if row.trace != doc.trace or row.article != doc.article:
		frappe.throw(_("Cette imposition n'appartient pas au tracé de cette étude."))
	_set_imposition(doc, row)
	doc.save()
	return _result(doc)


def _imposition_values(laize_pal, format_laize_palette, format_imp, nbr_poses, taux_chutes):
	"""Mêmes contrôles que le Desk. Le format est écrit en mm pour pouvoir être comparé à la presse."""
	laize_pal = cstr(laize_pal).strip()
	palette = cstr(format_laize_palette).strip().replace(",", ".").replace(" ", "")
	sheet = cstr(format_imp).strip().replace(",", ".").replace(" ", "").replace("×", "x").lower()
	if laize_pal not in ("Laize", "Palette"):
		frappe.throw(_("Choisissez laize ou palette."))
	if not (LENGTH if laize_pal == "Laize" else DIMENSION).match(palette.lower()):
		frappe.throw(_("Pour une laize, indiquez des chiffres (720). Pour une palette, un format (720x450)."))
	if not DIMENSION.match(sheet):
		frappe.throw(_("Le format d'impression s'écrit comme 720x450."))
	poses = cint(nbr_poses)
	if poses <= 0:
		frappe.throw(_("Indiquez le nombre de poses."))
	taux = flt(cstr(taux_chutes).replace(",", "."))
	if not 0 <= taux <= 100:
		frappe.throw(_("Le taux de chutes est un pourcentage."))
	laize, developpement = sheet.split("x")
	return {
		"laize_pal": laize_pal,
		"format_laize_palette": palette,
		"format_imp": sheet,
		"nbr_poses": poses,
		"taux_chutes": taux,
		"format_laize": flt(laize),
		"format_developpement": flt(developpement),
	}


@frappe.whitelist(methods=["POST"])
def save_imposition(name, modified, laize_pal, format_laize_palette, format_imp, nbr_poses, taux_chutes=0, imposition=None):
	"""Saisit une imposition et la lie à l'étude, ou met à jour celle de l'étude. Son taux de chutes y est reporté."""
	doc = _etude_for_work(name, modified)
	if not doc.trace:
		frappe.throw(_("Le tracé vient d'abord : l'imposition se calcule à partir de lui."))
	if imposition and imposition != doc.imposition:
		frappe.throw(_("Seule l'imposition de l'étude se met à jour ici."))
	values = _imposition_values(laize_pal, format_laize_palette, format_imp, nbr_poses, taux_chutes)
	row = frappe.get_doc("Imposition", imposition) if imposition else frappe.new_doc("Imposition")
	if not imposition:
		row.update({"client": doc.client, "article": doc.article, "trace": doc.trace, "procede": doc.procede, "origine_calcul": "Manuel"})
	row.update(values)
	row.save()
	_set_imposition(doc, row)
	doc.save()
	return _result(doc, piece=row.name)


@frappe.whitelist()
def get_etude_machines(name):
	"""Les presses du procédé avec, pour cette étude, passages, charge et alertes. Les moins alertées d'abord."""
	require_bureau()
	doc = frappe.get_doc(OFFSET, name)
	doc.check_permission("read")
	imposition = frappe.db.get_value("Imposition", doc.imposition, ["format_imp", "format_laize", "format_developpement"], as_dict=True) if doc.imposition else None
	feuilles = flt(doc.nbr_feuilles)
	rows = []
	for machine in get_machines_for_etude_selection(doc.procede, doc.article):
		info = machine.get("passages_info") or {}
		passages = cint(info.get("passages"))
		laize, developpement = flt(machine.format_max_laize), flt(machine.format_max_developpement)
		rows.append(
			{
				"name": machine.name,
				"nom": machine.nom or machine.name,
				"modele": " ".join(part for part in (machine.marque, machine.modele) if part) or None,
				"status": machine.status,
				"format": f"{_mm(laize)} × {_mm(developpement)}" if laize and developpement else None,
				"couleurs": cint(machine.total_couleurs),
				"vernis": bool(machine.vernis),
				"passages": passages,
				"passages_raison": info.get("raison") or None,
				"charge": feuilles * passages,
				"alertes": machine_alerts(machine, imposition, feuilles),
			}
		)
	return sorted(rows, key=lambda row: (sum(alert["tone"] == "red" for alert in row["alertes"]), len(row["alertes"])))


@frappe.whitelist(methods=["POST"])
def set_etude_machine(name, modified, machine=None):
	"""Choisit ou retire la presse. Une étude conclue la garde modifiable, une étude annulée non."""
	doc = _etude_for_action(name, modified)
	doc.check_permission("write")
	if doc.status in CLOSED_FOR_MACHINE:
		frappe.throw(_("La presse se choisit sur une étude démarrée."))
	if not _can_change_machine(doc):
		frappe.throw(_("Une fois l'étude conclue, seul le responsable d'étude change la presse."), frappe.PermissionError)
	machine = cstr(machine) or None
	if machine and machine not in {row.name for row in get_machines_for_etude_selection(doc.procede, doc.article)}:
		frappe.throw(_("Cette presse n'est pas proposée pour cette étude."))
	doc.machine_prevue = machine
	doc.save()
	return _result(doc)


@frappe.whitelist(methods=["POST"])
def set_etude_observations(name, modified, text=None):
	doc = _etude_for_work(name, modified)
	lines = cstr(text).strip()
	doc.observations = escape_html(lines).replace("\n", "<br>") if lines else None
	doc.save()
	return _result(doc)


@frappe.whitelist(methods=["POST"])
def set_piece_file(name, modified, piece, file_url):
	"""Range le fichier envoyé sur sa pièce, une fois celle-ci créée, et le recopie sur l'étude comme le Desk."""
	doc = _etude_for_work(name, modified)
	if piece not in FILES:
		frappe.throw(_("Pièce inconnue."))
	doctype, field, study_field = FILES[piece]
	target = doc.get(piece)
	if not target or not frappe.db.exists("File", {"file_url": file_url, "attached_to_doctype": doctype, "attached_to_name": target}):
		frappe.throw(_("Ce fichier n'est pas joint à cette pièce."))
	row = frappe.get_doc(doctype, target)
	row.set(field, file_url)
	row.save()
	doc.set(study_field, file_url)
	doc.save()
	return _result(doc)


@frappe.whitelist(methods=["POST"])
def link_existing_pieces(name, modified):
	"""L'article a déjà ses pièces : la sauvegarde de l'étude les lie, comme à son ouverture sur le Desk."""
	doc = _etude_for_work(name, modified)
	doc.save()
	return _result(doc)


@frappe.whitelist(methods=["POST"])
def save_plan_flexo(name, modified, dimensions, laize, sens_der=None):
	doc = _etude_for_work(name, modified)
	if doc.doctype != FLEXO:
		frappe.throw(_("Le plan Flexo concerne les études Flexo."))
	dimensions, laize = cstr(dimensions).strip(), cstr(laize).strip()
	if not dimensions or not laize:
		frappe.throw(_("Indiquez les dimensions et la laize du plan."))
	existing = doc.plan_flexo or frappe.db.get_value("Plan Flexo", {"article": doc.article}, "name")
	plan = frappe.get_doc("Plan Flexo", existing) if existing else frappe.new_doc("Plan Flexo")
	plan.update({"client": doc.client, "article": doc.article, "dimensions": dimensions, "laize": laize, "sens_der": cstr(sens_der) or None})
	plan.save()
	doc.plan_flexo = plan.name
	doc.fichier_plan_flexo = plan.fichier
	doc.save()
	return _result(doc, piece=plan.name)


@frappe.whitelist()
def get_cliche_options(name):
	require_bureau()
	doc = frappe.get_doc(FLEXO, name)
	doc.check_permission("read")
	frappe.has_permission("Cliche", "create", throw=True)
	developpements = frappe.get_all("Developpement", fields=["name", "title", "machine", "laize", "developpement"], order_by="title asc", limit_page_length=0)
	sites = frappe.get_all("Site Production", fields=["name", "title"], order_by="title asc", limit_page_length=0)
	return {
		"developpements": [{"value": row.name, "label": row.title or row.name} for row in developpements],
		"sites": [{"value": row.name, "label": row.title or row.name} for row in sites],
	}


@frappe.whitelist(methods=["POST"])
def create_cliche(name, modified, laize=None, nbr_couleurs=None, developpement=None, hauteur_cliche=None, site_prod=None):
	"""Crée le cliché en brouillon et le lie à l'étude. Sa validation et ses versions restent sur le Desk."""
	doc = _etude_for_work(name, modified)
	if doc.doctype != FLEXO:
		frappe.throw(_("Le cliché concerne les études Flexo."))
	if doc.cliche:
		frappe.throw(_("Cette étude a déjà son cliché."))
	cliche = frappe.new_doc("Cliche")
	cliche.update(
		{
			"client": doc.client,
			"article": doc.article,
			"maquette": doc.maquette,
			"laize": cstr(laize).strip() or None,
			"nbr_couleurs": cstr(nbr_couleurs).strip() or None,
			"developpement": cstr(developpement) or None,
			"hauteur_cliche": cstr(hauteur_cliche).strip() or None,
			"site_prod": cstr(site_prod) or None,
		}
	)
	cliche.insert()
	doc.cliche = cliche.name
	doc.save()
	return _result(doc, piece=cliche.name)
