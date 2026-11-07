# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Atelier d'imposition du poste de bureau : depuis une étude, ou en test rapide sans étude ni workflow.

Le moteur, le calcul et la génération du PDF restent dans `aurescrm.imposition`. Ici : ce que l'écran doit savoir, et
les règles propres au bureau. Un test rapide ne crée jamais d'imposition, faute d'article et de tracé. Une étude ne se
calcule et ne reçoit d'imposition que tant qu'elle est En étude.
"""

import frappe
from frappe import _
from frappe.utils import cint, flt

from aurescrm.api.bureau import _parse, require_bureau
from aurescrm.api.bureau_articles import _customers
from aurescrm.aures_crm.page.atelier_imposition.atelier_imposition import get_contexte
from aurescrm.imposition.api import creer_imposition, get_calcul, lancer_calcul, preparer_trace
from aurescrm.imposition.service import est_pdf, formats_connus

CALCUL = "Calcul Imposition"
ETUDE = "Etude Faisabilite"
IN_STUDY = "En étude"
# Valeurs du Desk quand ni le calcul ni la machine n'en donnent.
DEFAUTS = {"lisiere": 15.6, "pince": 10.0, "marge_arriere": 15.0}
# Formats plus proches que cela : le même, comme sur le Desk.
TOLERANCE_MM = 2


def _guard():
	require_bureau()
	frappe.has_permission(CALCUL, "read", throw=True)


def _same_format(left, right):
	return (
		abs(flt(left.get("laize")) - flt(right.get("laize"))) < TOLERANCE_MM
		and abs(flt(left.get("depl")) - flt(right.get("depl"))) < TOLERANCE_MM
		and cint(left.get("bobine")) == cint(right.get("bobine"))
	)


def merge_formats(proposes, etudies):
	"""Les formats à cocher : ceux du support, plus ceux que le calcul a étudiés. Sans calcul, tous cochés."""
	rows = []
	for format_ in proposes or []:
		checked = any(_same_format(format_, other) for other in etudies) if etudies else True
		rows.append({**_format_row(format_), "coche": checked})
	for format_ in etudies or []:
		if not any(_same_format(format_, row) for row in rows):
			rows.append({**_format_row(format_), "coche": True})
	return rows


def _format_row(format_):
	return {
		"laize": flt(format_.get("laize")),
		"depl": flt(format_.get("depl")),
		"origine": format_.get("origine") or "Manuel",
		"libelle": format_.get("libelle") or f"{flt(format_.get('laize')):g} × {flt(format_.get('depl')):g}",
		"bobine": cint(format_.get("bobine")),
	}


def _calcul_payload(name):
	# Les variantes ne servent qu'au moteur, et elles sont lourdes.
	return {key: value for key, value in get_calcul(name).items() if key != "variantes"}


def _etude_block(doc):
	customer = _customers([doc.client]).get(doc.client) or {}
	presse = None
	if doc.machine_prevue:
		row = frappe.db.get_value("Machine", doc.machine_prevue, ["format_max_laize", "format_max_developpement"], as_dict=True)
		if row and row.format_max_laize and row.format_max_developpement:
			presse = {"nom": doc.machine_prevue, "laize": flt(row.format_max_laize), "depl": flt(row.format_max_developpement)}
	fichier = frappe.db.get_value("Trace", doc.trace, "fichier_trace") if doc.trace else None
	return {
		"name": doc.name,
		"status": doc.status,
		"designation": doc.item_name or doc.article,
		"client_label": customer.get("customer_name") or doc.client,
		"quantite": cint(doc.quantite),
		"trace": doc.trace,
		"trace_fichier": fichier,
		"trace_lisible": est_pdf(fichier),
		"imposition": doc.imposition,
		"presse": presse,
		"ecriture": doc.status == IN_STUDY and bool(doc.has_permission("write")),
	}


def _historique(etude):
	filters = {"etude_faisabilite": etude} if etude else {"etude_faisabilite": ["is", "not set"], "owner": frappe.session.user}
	return frappe.get_list(
		CALCUL,
		filters=filters,
		fields=["name", "creation", "statut_calcul", "developpe_l", "developpe_d", "imposition_creee", "scenario_retenu", "fichier_trace", "quantite"],
		order_by="creation desc",
		limit_page_length=20,
	)


def _supports():
	rows = frappe.get_all("Support Technique", fields=["name"], order_by="name asc", limit_page_length=0)
	return [{"value": row.name, "label": row.name} for row in rows]


def _formats_du_support(support):
	return formats_connus(support=frappe.get_doc("Support Technique", support), stock_seul=True) if support else []


@frappe.whitelist()
def get_atelier(etude=None, calcul=None):
	"""Ce que l'atelier affiche. Avec une étude, son dernier calcul ; sans, un test rapide vierge ou repris."""
	_guard()
	doc = None
	if calcul:
		etude = frappe.db.get_value(CALCUL, calcul, "etude_faisabilite") or None
	if etude:
		doc = frappe.get_doc(ETUDE, etude)
		doc.check_permission("read")
		if not calcul:
			calcul = frappe.db.get_value(CALCUL, {"etude_faisabilite": etude}, "name", order_by="creation desc")
	result = _calcul_payload(calcul) if calcul else None
	if doc:
		context = get_contexte(article=doc.article, trace=doc.trace, etude=doc.name, calcul=calcul)
		proposes = context["formats_proposes"]
	else:
		context = get_contexte(calcul=calcul)
		proposes = context["formats_proposes"]
	reglages = {
		"pont": flt(context.get("pont")) or flt(context.get("pont_mini")),
		"sens_fibre": context.get("sens_fibre") or "Libre",
		"trait_commun": cint(context.get("trait_commun_autorise")),
		"quantite": cint(context.get("quantite")) or (cint(doc.quantite) if doc else 0),
		**{key: flt(context.get(key)) or default for key, default in DEFAUTS.items()},
	}
	return {
		"droits": {
			"calculer": bool(frappe.has_permission(CALCUL, "create") and frappe.has_permission(CALCUL, "write")),
			"creer_imposition": bool(frappe.has_permission("Imposition", "create")),
		},
		"etude": _etude_block(doc) if doc else None,
		"calcul": result,
		"fichier_trace": (result or {}).get("fichier_trace") or context.get("fichier_trace"),
		"support": context.get("support_technique"),
		# Un test repris n'a pas d'article : son grammage vient de son support.
		"grammage": flt(context.get("grammage")) or (flt(frappe.db.get_value("Support Technique", context["support_technique"], "grammage")) if context.get("support_technique") else 0),
		"supports": [] if doc else _supports(),
		"formats": merge_formats(proposes, (result or {}).get("formats_etudies") or []),
		"reglages": reglages,
		"historique": _historique(doc.name if doc else None),
	}


@frappe.whitelist()
def get_support_formats(support):
	"""En test rapide : les formats, le grammage et le pont du support choisi."""
	_guard()
	doc = frappe.get_doc("Support Technique", support)
	return {"grammage": flt(doc.grammage), "pont_mini": flt(doc.pont_mini), "formats": merge_formats(_formats_du_support(support), [])}


@frappe.whitelist()
def get_atelier_calcul(calcul):
	"""Où en est le calcul : l'écran le relit tant qu'il tourne."""
	_guard()
	return _calcul_payload(calcul)


def calcul_arguments(values):
	"""Les arguments du moteur. Avec une étude, article, client, tracé et quantité viennent d'elle, jamais de l'écran."""
	values = _parse(values) or {}
	etude, calcul = values.get("etude") or None, values.get("calcul") or None
	if calcul and (frappe.db.get_value(CALCUL, calcul, "etude_faisabilite") or None) != etude:
		frappe.throw(_("Ce calcul n'appartient pas à cette étude."))
	args = {
		"calcul": calcul,
		"etude": etude,
		"fichier_trace": values.get("fichier_trace") or None,
		"support_technique": values.get("support_technique") or None,
		"pont": values.get("pont"),
		"sens_fibre": values.get("sens_fibre"),
		"trait_commun_autorise": cint(values.get("trait_commun")),
		"quantite": cint(values.get("quantite")),
		"lisiere": flt(values.get("lisiere")),
		"pince": flt(values.get("pince")),
		"marge_arriere": flt(values.get("marge_arriere")),
		"ignorer_contraintes_machine": 1,
	}
	if etude:
		doc = frappe.get_doc(ETUDE, etude)
		doc.check_permission("write")
		if doc.status != IN_STUDY:
			frappe.throw(_("Démarrez l'étude pour calculer.") if doc.status == "Nouveau" else _("Cette étude est conclue : son atelier se lit seulement."))
		args.update(article=doc.article, client=doc.client, trace=doc.trace, quantite=cint(doc.quantite))
		args["fichier_trace"] = args["fichier_trace"] or (frappe.db.get_value("Trace", doc.trace, "fichier_trace") if doc.trace else None)
	if not args["fichier_trace"]:
		frappe.throw(_("Déposez d'abord un PDF de tracé."))
	return args, values


@frappe.whitelist(methods=["POST"])
def prepare_atelier(values):
	"""Lit le tracé déposé : développé et simulation, sans attendre un calcul."""
	_guard()
	args, _values = calcul_arguments(values)
	return _calcul_payload(preparer_trace(**args)["name"])


@frappe.whitelist(methods=["POST"])
def run_atelier(values):
	"""Lance le calcul en arrière-plan. L'écran le relit jusqu'à sa fin."""
	_guard()
	args, raw = calcul_arguments(values)
	formats = [_format_row(row) for row in raw.get("formats") or []]
	if not formats:
		frappe.throw(_("Cochez au moins un format à comparer."))
	started = lancer_calcul(formats=formats, inclure_sur_mesure=0, **args)
	return _calcul_payload(started["calcul"])


@frappe.whitelist(methods=["POST"])
def create_atelier_imposition(etude, calcul, scenario_idx):
	"""Crée l'imposition du scénario retenu et la lie à l'étude. Un test rapide n'a ni article ni tracé pour la recevoir."""
	_guard()
	doc = frappe.get_doc(ETUDE, etude)
	doc.check_permission("write")
	if doc.status != IN_STUDY:
		frappe.throw(_("Seule une étude en cours reçoit une imposition."))
	if frappe.db.get_value(CALCUL, calcul, "etude_faisabilite") != etude:
		frappe.throw(_("Ce calcul n'appartient pas à cette étude."))
	remplacee = doc.imposition or None
	created = creer_imposition(calcul=calcul, scenario_idx=scenario_idx)
	# La création écrit sur l'étude sans la sauvegarder : la sauvegarde recalcule feuilles, passages et charge.
	frappe.get_doc(ETUDE, etude).save()
	return {"imposition": created["imposition"], "remplacee": remplacee, "avertissement": created.get("avertissement_ideale"), "taux_chutes": flt(frappe.db.get_value("Imposition", created["imposition"], "taux_chutes"))}
