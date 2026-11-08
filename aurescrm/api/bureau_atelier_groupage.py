# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Groupage dans l'atelier : plusieurs articles d'un même support, pas forcément d'un même client, sur une feuille.

Le nombre de poses de chaque article est saisi. Chaque article garde la géométrie de son propre calcul ; une étude
sans calcul lisible en reçoit un, préparé depuis son tracé, sans lien avec l'étude (un test). À la création, une
Imposition par article, toutes sur le même PDF et la même clé de groupage : chaque étude garde ses poses, donc son
nombre de feuilles, et l'imposition d'un groupage ne devient jamais l'idéale de son article.
"""

import json
import os
import tempfile

import frappe
from frappe import _
from frappe.utils import cint, flt

from aurescrm.api.bureau import _parse
from aurescrm.api.bureau_articles import _customers
from aurescrm.api.bureau_atelier import CALCUL, ETUDE, IN_STUDY, _guard, est_gabarit
from aurescrm.imposition.api import preparer_trace
from aurescrm.imposition.groupage import ARTICLES_MAX, ArticleGroupe, feuilles, generer_pdf_groupe, grouper, positions_groupe, taux_chutes_feuille
from aurescrm.imposition.lecture_trace import lire_trace, silhouette
from aurescrm.imposition.service import appliquer_saisie_sur_params, champs_motif, chemin_pdf, est_pdf

OUVERTES = ("Nouveau", IN_STUDY)
MAX_CANDIDATS = 40


def _support_de(article):
	return frappe.db.get_value("Item", article, ["custom_support", "custom_grammage"], as_dict=True) or {}


@frappe.whitelist()
def group_candidates(etude):
	"""Les études ouvertes dont l'article a le même support et le même grammage, quel que soit le client."""
	_guard()
	doc = frappe.get_doc(ETUDE, etude)
	doc.check_permission("read")
	support = _support_de(doc.article)
	if not support.get("custom_support"):
		return {"support": None, "etudes": []}
	articles = frappe.get_all("Item", filters={"custom_support": support.custom_support, "custom_grammage": support.custom_grammage}, pluck="name", limit_page_length=0)
	rows = frappe.get_list(
		ETUDE,
		filters={"name": ["!=", etude], "status": ["in", OUVERTES], "docstatus": 0, "trace": ["is", "set"], "article": ["in", articles or [""]]},
		fields=["name", "article", "item_name", "client", "quantite", "status", "trace"],
		order_by="modified desc",
		limit_page_length=MAX_CANDIDATS,
	)
	fichiers = dict(frappe.get_all("Trace", filters={"name": ["in", [row.trace for row in rows] or [""]]}, fields=["name", "fichier_trace"], as_list=True))
	clients = _customers([row.client for row in rows])
	return {
		"support": f"{support.custom_support} {cint(support.custom_grammage)} g" if support.custom_grammage else support.custom_support,
		"etudes": [
			{
				"name": row.name,
				"designation": row.item_name or row.article,
				"client_label": (clients.get(row.client) or {}).get("customer_name") or row.client,
				"quantite": cint(row.quantite),
				"status": row.status,
				"lisible": est_pdf(fichiers.get(row.trace)),
			}
			for row in rows
		],
	}


def _calcul_pret(name):
	return bool(name and frappe.db.get_value(CALCUL, name, "variantes_json") and frappe.db.get_value(CALCUL, name, "bornes_json"))


def _calcul_de(etude_doc, fichier):
	"""Le calcul dont on reprend la géométrie : le dernier de l'étude sur ce tracé, sinon un test préparé depuis le tracé."""
	for filters in ({"etude_faisabilite": etude_doc.name, "fichier_trace": fichier}, {"fichier_trace": fichier}):
		for name in frappe.get_all(CALCUL, filters=filters, pluck="name", order_by="creation desc", limit_page_length=5):
			if _calcul_pret(name):
				return name
	prepared = preparer_trace(fichier_trace=fichier, article=etude_doc.article, client=etude_doc.client, trace=etude_doc.trace)
	if not _calcul_pret(prepared["name"]):
		frappe.throw(_("Le tracé de l'étude {0} ne se lit pas : il ne peut pas être groupé.").format(etude_doc.name))
	return prepared["name"]


def _membres(etude, calcul, membres):
	"""Les études du groupage, l'étude ouverte d'abord, chacune avec son calcul et ses poses."""
	membres = _parse(membres) or []
	if not isinstance(membres, list) or not membres:
		frappe.throw(_("Ajoutez au moins un autre article à la feuille."))
	if membres[0].get("etude") != etude:
		frappe.throw(_("L'étude ouverte vient en premier."))
	noms = [row.get("etude") for row in membres]
	if len(set(noms)) != len(noms):
		frappe.throw(_("Une étude ne figure qu'une fois sur la feuille."))
	if not 2 <= len(membres) <= ARTICLES_MAX:
		frappe.throw(_("De deux à {0} articles sur une feuille.").format(ARTICLES_MAX))
	if frappe.db.get_value(CALCUL, calcul, "etude_faisabilite") != etude:
		frappe.throw(_("Ce calcul n'appartient pas à cette étude."))
	support = None
	sortie = []
	for index, row in enumerate(membres):
		doc = frappe.get_doc(ETUDE, row["etude"])
		doc.check_permission("read")
		poses = cint(row.get("poses"))
		if poses < 1:
			frappe.throw(_("Indiquez les poses de l'étude {0}.").format(doc.name))
		this = _support_de(doc.article)
		cle = (this.get("custom_support"), cint(this.get("custom_grammage")))
		if support is None:
			support = cle
		elif cle != support:
			frappe.throw(_("L'étude {0} n'est pas sur le même support.").format(doc.name))
		if index == 0:
			nom = calcul
		else:
			if doc.status not in OUVERTES or doc.docstatus != 0:
				frappe.throw(_("L'étude {0} est conclue : elle ne se groupe plus.").format(doc.name))
			fichier = frappe.db.get_value("Trace", doc.trace, "fichier_trace") if doc.trace else None
			if not est_pdf(fichier):
				frappe.throw(_("L'étude {0} n'a pas de PDF de tracé lisible.").format(doc.name))
			nom = _calcul_de(doc, fichier)
		calcul_doc = frappe.get_doc(CALCUL, nom)
		sortie.append({"etude": doc, "calcul": calcul_doc, "poses": poses})
	return sortie


def _articles(membres):
	return [ArticleGroupe(variantes=m["calcul"].charge_variantes(), poses=m["poses"], quantite=cint(m["etude"].quantite), surface_utile_mm2=flt(m["calcul"].surface_utile_mm2)) for m in membres]


def _parametres(membres, lisiere=None, pince=None, marge_arriere=None):
	"""Les réglages de la feuille : ceux du calcul de l'étude ouverte, marges de l'écran, sans contrainte machine."""
	params = membres[0]["calcul"].charge_parametres()
	if not params:
		frappe.throw(_("Calculez d'abord l'étude ouverte."))
	appliquer_saisie_sur_params(params, lisiere=flt(lisiere) if lisiere is not None else None, pince=flt(pince) if pince is not None else None, marge_arriere=flt(marge_arriere) if marge_arriere is not None else None, ignorer=1)
	return params


def _silhouettes(calcul_doc):
	try:
		return json.loads(calcul_doc.silhouette_svg or "{}")
	except (TypeError, ValueError):
		return {}


def _ligne(g, articles, membres):
	tirage, besoins, surplus = feuilles(g, articles)
	return {
		"laize": g.laize,
		"depl": g.depl,
		"libelle": f"{g.laize:g} × {g.depl:g}",
		"sens": g.sens,
		"nb_poses": g.poses,
		"nb_feuilles": tirage,
		"taux_chutes": taux_chutes_feuille(g, articles),
		"reste_laize": g.reste_laize,
		"reste_depl": g.reste_depl,
		"poses": [[article, round(x, 2), round(y, 2), rot] for article, x, y, rot in positions_groupe(g)],
		"blocs": [
			{
				"etude": membres[b.article]["etude"].name,
				"poses": b.disposition.poses,
				"n_col": b.disposition.n_col,
				"n_rang": b.disposition.n_rang,
				"rotation": b.disposition.rotation,
				"motif": champs_motif(b.disposition)["motif"],
				"x": b.x,
				"y": b.y,
				"feuilles_necessaires": besoins[b.article],
				"surproduction": surplus[b.article],
			}
			for b in g.blocs
		],
	}


@frappe.whitelist(methods=["POST"])
def simulate_group(etude, calcul, membres, formats, lisiere=None, pince=None, marge_arriere=None):
	"""Pour chaque format coché, la feuille groupée la plus compacte, ou la raison pour laquelle elle ne tient pas."""
	_guard()
	found = _membres(etude, calcul, membres)
	articles = _articles(found)
	params = _parametres(found, lisiere, pince, marge_arriere)
	formats = [row for row in (_parse(formats) or []) if not cint(row.get("bobine")) and flt(row.get("laize")) > 0 and flt(row.get("depl")) > 0]
	if not formats:
		frappe.throw(_("Cochez au moins un format de feuille : une bobine ne se groupe pas encore."))
	lignes, refus = [], []
	for row in formats:
		g = grouper(articles, params, flt(row["laize"]), flt(row["depl"]))
		if g:
			lignes.append(_ligne(g, articles, found))
		else:
			refus.append(row.get("libelle") or f"{flt(row['laize']):g} × {flt(row['depl']):g}")
	lignes.sort(key=lambda line: (line["nb_feuilles"], line["taux_chutes"]))
	clients = _customers([m["etude"].client for m in found])
	return {
		"membres": [
			{
				"etude": m["etude"].name,
				"designation": m["etude"].item_name or m["etude"].article,
				"client_label": (clients.get(m["etude"].client) or {}).get("customer_name") or m["etude"].client,
				"quantite": cint(m["etude"].quantite),
				"status": m["etude"].status,
				"calcul": m["calcul"].name,
				"silhouette": _silhouettes(m["calcul"]),
			}
			for m in found
		],
		"lignes": lignes,
		"refus": refus,
		"lisiere": params.lisiere,
		"pince": params.pince,
	}


@frappe.whitelist(methods=["POST"])
def create_group_imposition(etude, calcul, membres, laize, depl, lisiere=None, pince=None, marge_arriere=None):
	"""Une Imposition par article, sur le même PDF et la même clé de groupage, liée à chaque étude. Toutes doivent être En étude."""
	_guard()
	if not frappe.get_meta("Imposition").has_field("groupage"):
		frappe.throw(_("Le groupage attend la mise à jour de la base (migration)."))
	if not frappe.has_permission("Imposition", "create"):
		frappe.throw(_("Votre rôle ne crée pas d'imposition."))
	found = _membres(etude, calcul, membres)
	for m in found:
		doc = m["etude"]
		doc.check_permission("write")
		if doc.status != IN_STUDY:
			frappe.throw(_("Démarrez l'étude {0} avant de lui donner une imposition groupée.").format(doc.name))
		if est_gabarit(m["calcul"].fichier_trace):
			frappe.throw(_("L'étude {0} part d'un gabarit standard : déposez son vrai tracé.").format(doc.name))
	articles = _articles(found)
	params = _parametres(found, lisiere, pince, marge_arriere)
	g = grouper(articles, params, flt(laize), flt(depl))
	if not g:
		frappe.throw(_("Les poses demandées ne tiennent plus sur ce format."))
	ligne = _ligne(g, articles, found)

	geometries = []
	for m in found:
		coupe, rainage = lire_trace(chemin_pdf(m["calcul"].fichier_trace))
		geometries.append((coupe, rainage, silhouette(coupe, rainage)))
	cle = f"GRP-{frappe.generate_hash(length=8).upper()}"
	titre = f"Groupage {cle} - " + ", ".join(f"{m['etude'].article} x{m['poses']}" for m in found)
	with tempfile.TemporaryDirectory() as dossier:
		chemin = generer_pdf_groupe(os.path.join(dossier, "groupage.pdf"), geometries, g, params, titre=titre)
		with open(chemin, "rb") as source:
			contenu = source.read()

	table = [
		{
			"etude": m["etude"].name,
			"article": m["etude"].article,
			"client": m["etude"].client,
			"trace": m["etude"].trace,
			"quantite": cint(m["etude"].quantite),
			"poses": bloc["poses"],
			"n_col": bloc["n_col"],
			"n_rang": bloc["n_rang"],
			"rotation": bloc["rotation"],
			"motif": bloc["motif"],
			"origine_x": bloc["x"],
			"origine_y": bloc["y"],
			"feuilles_necessaires": bloc["feuilles_necessaires"],
			"surproduction": bloc["surproduction"],
			"calcul_imposition": m["calcul"].name,
		}
		for m, bloc in zip(found, ligne["blocs"])
	]
	creees = []
	for m, b in zip(found, g.blocs):
		etude_doc, calcul_doc, d = m["etude"], m["calcul"], b.disposition
		imposition = frappe.get_doc(
			{
				"doctype": "Imposition",
				"client": etude_doc.client,
				"article": etude_doc.article,
				"trace": etude_doc.trace,
				"procede": etude_doc.get("procede"),
				"nbr_poses": d.poses,
				"taux_chutes": ligne["taux_chutes"],
				"format_imp": f"{g.laize:g} x {g.depl:g}",
				"format_laize": g.laize,
				"format_developpement": g.depl,
				"n_col": d.n_col,
				"n_rang": d.n_rang,
				"rotation": d.rotation,
				"pas_laize": d.pas_laize,
				"pas_depl": d.pas_depl,
				"pont": params.pont,
				"trait_commun_laize": cint(d.trait_commun_laize),
				"trait_commun_depl": cint(d.trait_commun_depl),
				# La clé de groupage, et non l'origine (Manuel ou Moteur v1), dit qu'elle est groupée.
				"origine_calcul": "Moteur v1",
				"scenario_retenu": f"Groupage {g.laize:g} × {g.depl:g}",
				"calcul_imposition": calcul_doc.name,
				"groupage": cle,
				"articles_groupes": table,
				**champs_motif(d),
			}
		)
		imposition.insert()
		fichier = frappe.get_doc({"doctype": "File", "file_name": f"imposition-{imposition.name}.pdf", "attached_to_doctype": "Imposition", "attached_to_name": imposition.name, "attached_to_field": "fichier_imp", "is_private": 1, "content": contenu}).insert()
		imposition.db_set("fichier_imp", fichier.file_url)
		etude_doc.add_comment("Comment", text=_("Imposition groupée <b>{0}</b> ({1}) : {2} poses sur {3} × {4} mm avec {5} autre(s) article(s).").format(imposition.name, cle, d.poses, f"{g.laize:g}", f"{g.depl:g}", len(found) - 1))
		etude_doc.db_set({"imposition": imposition.name, "fichier_imp": fichier.file_url, "taux_chutes": ligne["taux_chutes"], "calcul_imposition": calcul_doc.name}, update_modified=False)
		# La sauvegarde recalcule feuilles, passages et charge, comme pour une imposition seule.
		frappe.get_doc(ETUDE, etude_doc.name).save()
		creees.append({"etude": etude_doc.name, "imposition": imposition.name})
	return {"groupage": cle, "impositions": creees, "nb_feuilles": ligne["nb_feuilles"]}
