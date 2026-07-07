# Copyright (c) 2026, Medigo and contributors
# License: MIT
"""Calcul du nombre de passages presse offset.

Règles métier :
- Couleurs à imprimer : maquette activée (process + spots), sinon champ couleurs de l'article.
- Vernis gras (mat gras) : consomme un groupe encre.
- Vernis acrylique / UV : appliqués via le tour vernis de la presse ; sans tour vernis,
  le vernis consomme un groupe encre.
- Drip off : deux vernis — un gras (groupe encre) + un acrylique (tour vernis).
- Vernis sérigraphique : hors ligne (autre machine), aucun impact sur les passages presse.
- Recto/verso : sans impact sur le nombre de passages (règle atelier).
"""

import json
import math
import re

import frappe
from frappe import _
from frappe.utils import cint, flt

# Vernis appliqués via le tour vernis de la presse (drip off = sa partie acrylique).
VERNIS_TOUR_FIELDS = ("custom_acrylique", "custom_uv", "custom_drip_off")
# Vernis consommant un groupe encre (drip off = sa partie grasse).
VERNIS_GROUPE_FIELDS = ("custom_mat_gras", "custom_drip_off")
# Vernis hors ligne : aucun impact presse.
VERNIS_HORS_LIGNE_FIELDS = ("custom_vernis_serigraphique",)

VERNIS_LABELS = {
	"custom_acrylique": "Acrylique",
	"custom_uv": "UV",
	"custom_drip_off": "Drip off",
	"custom_mat_gras": "Gras",
	"custom_vernis_serigraphique": "Sérigraphique",
}

_ITEM_VERNIS_FIELDS = tuple(
	dict.fromkeys(VERNIS_TOUR_FIELDS + VERNIS_GROUPE_FIELDS + VERNIS_HORS_LIGNE_FIELDS)
)


def _parse_couleurs_item(raw) -> int:
	"""Extrait un nombre de couleurs d'un champ article libre.

	Exemples : « 5 » → 5 ; « CMJN » → 4 ; « CMJN + 2 » → 6 ; « 5 + vernis » → 5.
	"""
	s = (str(raw) if raw is not None else "").strip().lower()
	if not s:
		return 0
	base = 4 if ("cmjn" in s or "quadri" in s) else 0
	nums = [cint(x) for x in re.findall(r"\d+", s)]
	if base:
		return base + sum(nums)
	return nums[0] if nums else 0


def get_besoins_impression(article: str, maquette: str | None = None) -> dict:
	"""Couleurs et vernis requis pour imprimer un article (maquette activée prioritaire)."""
	out = {
		"couleurs": 0,
		"source_couleurs": None,
		"maquette": None,
		"vernis_groupe": 0,
		"vernis_tour": False,
		"vernis_presse_labels": [],
		"vernis_hors_ligne_labels": [],
	}
	if not article:
		return out

	maq = None
	if maquette and frappe.db.exists("Maquette", maquette):
		maq = frappe.db.get_value(
			"Maquette",
			maquette,
			["name", "nombre_couleurs_process", "nombre_spot_colors"],
			as_dict=True,
		)
	if not maq:
		maq = frappe.db.get_value(
			"Maquette",
			{"article": article, "status": "Version Activée"},
			["name", "nombre_couleurs_process", "nombre_spot_colors"],
			as_dict=True,
			order_by="modified desc",
		)
	if maq:
		out["maquette"] = maq.name
		couleurs_maquette = cint(maq.nombre_couleurs_process) + cint(maq.nombre_spot_colors)
		if couleurs_maquette:
			out["couleurs"] = couleurs_maquette
			out["source_couleurs"] = "maquette"

	item = frappe.db.get_value(
		"Item",
		article,
		["custom_nbr_couleurs", *_ITEM_VERNIS_FIELDS],
		as_dict=True,
	)
	if not item:
		return out

	if not out["couleurs"]:
		couleurs_item = _parse_couleurs_item(item.get("custom_nbr_couleurs"))
		if couleurs_item:
			out["couleurs"] = couleurs_item
			out["source_couleurs"] = "article"

	if any(cint(item.get(f)) for f in VERNIS_GROUPE_FIELDS):
		out["vernis_groupe"] = 1
	out["vernis_tour"] = any(cint(item.get(f)) for f in VERNIS_TOUR_FIELDS)

	seen = set()
	for f in VERNIS_GROUPE_FIELDS + VERNIS_TOUR_FIELDS:
		if cint(item.get(f)) and f not in seen:
			seen.add(f)
			out["vernis_presse_labels"].append(VERNIS_LABELS.get(f, f))
	out["vernis_hors_ligne_labels"] = [
		VERNIS_LABELS.get(f, f) for f in VERNIS_HORS_LIGNE_FIELDS if cint(item.get(f))
	]
	return out


def compute_passages(
	total_couleurs_machine,
	machine_a_tour_vernis,
	couleurs,
	vernis_groupe=0,
	vernis_tour=False,
) -> dict:
	"""Nombre de passages = ceil(groupes encre requis / groupes machine).

	Le tour vernis absorbe le vernis acrylique/UV sans consommer de groupe ;
	sans tour, le vernis passe dans un groupe encre supplémentaire.
	"""
	couleurs = cint(couleurs)
	cap = cint(total_couleurs_machine)
	groupes = couleurs + cint(vernis_groupe)
	tour_utilise = bool(vernis_tour) and bool(machine_a_tour_vernis)
	if vernis_tour and not machine_a_tour_vernis:
		groupes += 1

	if couleurs <= 0:
		return {
			"calculable": False,
			"passages": 0,
			"groupes_requis": groupes,
			"tour_vernis_utilise": False,
			"raison": _("Nombre de couleurs inconnu (pas de maquette activée ni de couleurs article)."),
		}
	if cap <= 0:
		return {
			"calculable": False,
			"passages": 0,
			"groupes_requis": groupes,
			"tour_vernis_utilise": tour_utilise,
			"raison": _("Total couleurs non renseigné sur la machine."),
		}
	return {
		"calculable": True,
		"passages": max(1, math.ceil(groupes / cap)),
		"groupes_requis": groupes,
		"tour_vernis_utilise": tour_utilise,
		"raison": "",
	}


def _machine_capacites(machine: str) -> dict | None:
	return frappe.db.get_value(
		"Machine", machine, ["name", "total_couleurs", "vernis"], as_dict=True
	)


def _build_detail(besoins: dict, machine_caps: dict, res: dict) -> str:
	"""Résumé lisible du calcul (affiché dans les fiches machine / infobulles)."""
	parts = []
	src = {"maquette": _("maquette"), "article": _("article")}.get(besoins.get("source_couleurs"))
	c = cint(besoins.get("couleurs"))
	parts.append(f"{c} {_('couleur(s)')}" + (f" ({src})" if src else ""))
	if besoins.get("vernis_groupe"):
		parts.append(_("+1 groupe vernis gras"))
	if besoins.get("vernis_tour"):
		parts.append(
			_("vernis tour ({0})").format(", ".join(besoins.get("vernis_presse_labels") or []))
			+ ("" if machine_caps.get("vernis") else " " + _("(machine sans tour → +1 groupe)"))
		)
	txt = " · ".join(parts)
	txt += f" → {cint(res.get('groupes_requis'))} {_('groupe(s) requis')}"
	txt += f" / {_('machine')} {cint(machine_caps.get('total_couleurs'))} {_('groupe(s)')}"
	if machine_caps.get("vernis"):
		txt += " + " + _("tour vernis")
	if res.get("calculable"):
		txt += f" ⇒ {cint(res.get('passages'))} {_('passage(s)')}"
	else:
		txt += f" ⇒ {res.get('raison')}"
	if besoins.get("vernis_hors_ligne_labels"):
		txt += " · " + _("Hors ligne : {0}").format(", ".join(besoins["vernis_hors_ligne_labels"]))
	return txt


@frappe.whitelist()
def get_passages_pour_machine(article: str, machine: str, maquette: str | None = None) -> dict:
	"""Passages presse pour un article sur une machine (source de vérité UI + serveur)."""
	if not article or not machine:
		return {"calculable": False, "passages": 0, "raison": _("Article et machine requis.")}
	caps = _machine_capacites(machine)
	if not caps:
		return {"calculable": False, "passages": 0, "raison": _("Machine introuvable.")}
	besoins = get_besoins_impression(article, maquette)
	res = compute_passages(
		caps.total_couleurs,
		caps.vernis,
		besoins["couleurs"],
		besoins["vernis_groupe"],
		besoins["vernis_tour"],
	)
	res.update(
		{
			"machine": caps.name,
			"besoins": besoins,
			"detail": _build_detail(besoins, caps, res),
		}
	)
	return res


@frappe.whitelist()
def get_passages_par_machine(article: str, machines=None) -> dict:
	"""Passages pour un article sur plusieurs machines (dialogue de sélection)."""
	if isinstance(machines, str):
		machines = json.loads(machines or "[]")
	machines = [m for m in (machines or []) if m]
	if not article or not machines:
		return {}
	besoins = get_besoins_impression(article)
	out = {}
	for row in frappe.get_all(
		"Machine",
		filters={"name": ["in", machines]},
		fields=["name", "total_couleurs", "vernis"],
	):
		res = compute_passages(
			row.total_couleurs,
			row.vernis,
			besoins["couleurs"],
			besoins["vernis_groupe"],
			besoins["vernis_tour"],
		)
		res["detail"] = _build_detail(besoins, row, res)
		out[row.name] = res
	return out


def get_nb_passages(article: str | None, machine: str | None, maquette: str | None = None) -> int:
	"""Nombre de passages stockable sur un document ; 0 = non calculable / non affecté."""
	if not article or not machine:
		return 0
	res = get_passages_pour_machine(article, machine, maquette)
	return cint(res.get("passages")) if res.get("calculable") else 0


def update_etude_technique_passages(et_name: str) -> None:
	"""Recalcule nb_passages/charge d'une étude technique mise à jour via db.set_value."""
	et = frappe.db.get_value(
		"Etude Technique", et_name, ["article", "machine", "maquette", "quant_feuilles"], as_dict=True
	)
	if not et:
		return
	nb = get_nb_passages(et.article, et.machine, et.maquette)
	frappe.db.set_value(
		"Etude Technique",
		et_name,
		{"nb_passages": nb, "charge_feuilles": flt(et.quant_feuilles or 0) * nb},
		update_modified=False,
	)
