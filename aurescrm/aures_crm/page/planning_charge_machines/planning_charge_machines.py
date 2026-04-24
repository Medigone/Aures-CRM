# Copyright (c) 2026, Medigo and contributors
# License: MIT

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

import frappe
from frappe import _
from frappe.utils import add_days, cstr, format_date, getdate, today

UNASSIGNED = "__UNASSIGNED__"
NO_DATE_KEY = "__NO_DATE__"


def parse_sources(sources) -> set[str]:
	"""Sources autorisées : faisabilité et étude technique uniquement (pas d'ordres de production)."""
	valid = {"faisabilite", "technique"}
	if not sources:
		return set(valid)
	if isinstance(sources, (list, tuple)):
		parts = [str(p).strip() for p in sources if str(p).strip()]
		return set(parts) & valid if parts else set(valid)
	if isinstance(sources, str):
		try:
			parsed = json.loads(sources)
			if isinstance(parsed, list):
				parts = [str(p).strip() for p in parsed if str(p).strip()]
			else:
				parts = [p.strip() for p in sources.split(",") if p.strip()]
		except json.JSONDecodeError:
			parts = [p.strip() for p in sources.split(",") if p.strip()]
	else:
		parts = [str(p).strip() for p in sources if str(p).strip()]
	return set(parts) & valid if parts else set(valid)


def _get_offset_presse_machine_names() -> set[str] | None:
	"""Machines d'impression offset uniquement (presse offset + procédé offset)."""
	names = frappe.get_all(
		"Machine",
		filters={"type_equipement": "Presse Offset", "procede": "Offset"},
		pluck="name",
	) or []
	if not names:
		return None
	return set(names)


def _normalize_temporal_basis(raw: str | None) -> str:
	"""Accepte les libellés UI (Planification / Livraison) ou les anciennes clés internes."""
	r = (raw or "").strip()
	if r in ("livraison_client", "Livraison"):
		return "livraison_client"
	if r in ("planification_production", "Planification"):
		return "planification_production"
	return "planification_production"


def _normalize_granularity(raw: str | None) -> str:
	"""Jour / Semaine / Mois (UI) ou day / week / month."""
	g = (raw or "day").strip().lower()
	fr_to = {"jour": "day", "semaine": "week", "mois": "month"}
	if g in fr_to:
		return fr_to[g]
	if g in ("day", "week", "month"):
		return g
	return "day"


def _allowed_machines_for_query(filter_names: list[str] | None) -> set[str] | None:
	"""Pool presses offset ; None = pas de restriction par nom (comportement historique si pas de machines en base)."""
	base = _get_offset_presse_machine_names()
	if not filter_names:
		return base
	requested = set(filter_names)
	if base is not None:
		return requested & base
	valid = set(
		frappe.get_all(
			"Machine",
			filters={
				"name": ["in", list(requested)],
				"type_equipement": "Presse Offset",
				"procede": "Offset",
			},
			pluck="name",
		)
		or []
	)
	return valid if valid else set()


def _machine_allowed(machine: str | None, allowed: set[str] | None) -> bool:
	if not machine:
		return True
	if allowed is None:
		return True
	return machine in allowed


def _hydrate_labels(jobs: list[dict]) -> None:
	customers = {j["client"] for j in jobs if j.get("client")}
	items = {j["article"] for j in jobs if j.get("article")}
	c_map = {}
	if customers:
		for row in frappe.get_all(
			"Customer", filters={"name": ["in", list(customers)]}, fields=["name", "customer_name"]
		):
			c_map[row.name] = row.customer_name or row.name
	i_map = {}
	if items:
		for row in frappe.get_all("Item", filters={"name": ["in", list(items)]}, fields=["name", "item_name"]):
			i_map[row.name] = row.item_name or row.name
	for j in jobs:
		j["client_label"] = c_map.get(j.get("client"), "") or ""
		j["article_label"] = i_map.get(j.get("article"), "") or ""
		j["client_code"] = (j.get("client") or "").strip()
		j["item_code"] = (j.get("article") or "").strip()


def _deduplicate_jobs(jobs: list[dict]) -> list[dict]:
	"""Garde au plus une ligne par demande de faisabilité : l'étude technique prime sur la faisabilité."""
	demandes_any = set()
	for j in jobs:
		if j["source_key"] == "technique" and j.get("demande_faisabilite"):
			demandes_any.add(j["demande_faisabilite"])
	return [
		j
		for j in jobs
		if not (j["source_key"] == "faisabilite" and j.get("demande_faisabilite") in demandes_any)
	]


def _bucket_date(raw: str | None, granularity: str) -> date | None:
	if not raw:
		return None
	dd = getdate(raw)
	if granularity == "day":
		return dd
	if granularity == "week":
		return dd - timedelta(days=dd.weekday())
	if granularity == "month":
		return date(dd.year, dd.month, 1)
	return dd


def _date_label(dkey: str, granularity: str) -> str:
	if dkey == NO_DATE_KEY:
		return str(_("Sans date"))
	dt = getdate(dkey)
	if granularity == "month":
		return format_date(dt)
	if granularity == "week":
		end = dt + timedelta(days=6)
		return f"{format_date(dt)} – {format_date(end)}"
	return format_date(dt)


def _normalize_state_color(color: str | None) -> str:
	c = (color or "gray").strip().lower().replace(" ", "")
	if c in ("grey", "darkgrey"):
		c = "gray"
	return c


def _get_faisabilite_status_indicator(status: str) -> str:
	"""Couleur d'indicateur (classe CSS) alignée sur les states du DocType Etude Faisabilite."""
	st = (status or "").strip()
	meta = frappe.get_meta("Etude Faisabilite")
	for s in meta.states or []:
		title = (getattr(s, "title", None) or "").strip()
		if title == st:
			return _normalize_state_color(getattr(s, "color", None))
	# Repli si meta pas encore migré
	fallback = {
		"Nouveau": "blue",
		"En étude": "orange",
		"Réalisable": "green",
		"Non Réalisable": "red",
		"Annulée": "gray",
	}
	return fallback.get(st, "gray")


def _get_technique_status_indicator(status: str) -> str:
	"""Indicateur aligné sur les states du DocType Etude Technique."""
	st = (status or "").strip()
	meta = frappe.get_meta("Etude Technique")
	for s in meta.states or []:
		title = (getattr(s, "title", None) or "").strip()
		if title == st:
			return _normalize_state_color(getattr(s, "color", None))
	fallback = {
		"Nouveau": "blue",
		"En Cours": "yellow",
		"Terminée": "green",
		"Rejetée": "orange",
		"Annulée": "red",
	}
	return fallback.get(st, "gray")


def _get_machine_status_indicator(status: str) -> str:
	"""Indicateur aligné sur les states du DocType Machine."""
	st = (status or "").strip()
	meta = frappe.get_meta("Machine")
	for s in meta.states or []:
		title = (getattr(s, "title", None) or "").strip()
		if title == st:
			return _normalize_state_color(getattr(s, "color", None))
	fallback = {
		"Operationnelle": "green",
		"En Maintenance": "orange",
		"En Panne": "red",
		"Hors Service": "gray",
		"Désactivé": "gray",
	}
	return fallback.get(st, "gray")


def _machine_meta_entries(ordered_machines: list[str]) -> list[dict[str, Any]]:
	"""Métadonnées d'en-tête colonne : nom + statut machine (indicateur + libellé infobulle)."""
	out: list[dict[str, Any]] = []
	real = [m for m in ordered_machines if m != UNASSIGNED]
	by_name: dict[str, dict[str, str]] = {}
	if real:
		for row in frappe.get_all(
			"Machine",
			filters={"name": ["in", real]},
			fields=["name", "nom", "status"],
		):
			by_name[row.name] = {
				"nom": (row.get("nom") or row.name or "").strip(),
				"status": (row.get("status") or "").strip(),
			}
	for m in ordered_machines:
		if m == UNASSIGNED:
			out.append(
				{
					"name": UNASSIGNED,
					"label": str(_("Non affectée")),
					"machine_status_indicator": None,
					"machine_status_label": None,
				}
			)
			continue
		info = by_name.get(m, {})
		nom = info.get("nom") or m
		st = info.get("status") or ""
		if not st:
			out.append(
				{
					"name": m,
					"label": nom,
					"machine_status_indicator": "gray",
					"machine_status_label": str(_("Non renseigné")),
				}
			)
		else:
			out.append(
				{
					"name": m,
					"label": nom,
					"machine_status_indicator": _get_machine_status_indicator(st),
					"machine_status_label": st,
				}
			)
	return out


def _fetch_faisabilite(
	temporal_basis: str,
	date_from: date,
	date_to: date,
	niveau_urgence: str | None,
	allowed_machines: set[str] | None,
) -> list[dict]:
	filters: dict[str, Any] = {
		"docstatus": ["<", 2],
		"procede": "Offset",
		"status": ["in", ["Nouveau", "Réalisable"]],
	}
	if niveau_urgence:
		filters["niveau_urgence"] = niveau_urgence

	fields = [
		"name",
		"machine_prevue",
		"date_echeance",
		"date_livraison",
		"client",
		"article",
		"quantite",
		"nbr_feuilles",
		"status",
		"niveau_urgence",
		"demande_faisabilite",
		"procede",
	]
	rows = frappe.get_all("Etude Faisabilite", filters=filters, fields=fields)
	out = []
	for r in rows:
		m = r.get("machine_prevue") or ""
		if not _machine_allowed(m or None, allowed_machines):
			continue
		dt_liv = r.get("date_livraison")
		dt_plan = r.get("date_echeance")
		if temporal_basis == "livraison_client":
			d = dt_liv
		else:
			d = dt_plan
		if d and not (date_from <= getdate(d) <= date_to):
			continue
		st_label = r.get("status") or ""
		out.append(
			{
				"source": "Etude Faisabilite",
				"source_key": "faisabilite",
				"doc_name": r.name,
				"machine": m,
				"stored_plan_date": r.get("date_echeance"),
				"raw_date": str(d) if d else None,
				"dt_livraison": str(dt_liv) if dt_liv else None,
				"dt_planification": str(dt_plan) if dt_plan else None,
				"client": r.get("client") or "",
				"article": r.get("article") or "",
				"qte_article": r.get("quantite") or 0,
				"qte_feuilles": float(r.get("nbr_feuilles") or 0),
				"statut": st_label,
				"status_badge": {
					"label": st_label,
					"indicator": _get_faisabilite_status_indicator(st_label),
				},
				"urgence": r.get("niveau_urgence") or "",
				"demande_faisabilite": r.get("demande_faisabilite") or "",
				"etude_technique": None,
				"stage": 1,
			}
		)
	return out


def _fetch_technique(
	temporal_basis: str,
	date_from: date,
	date_to: date,
	niveau_urgence: str | None,
	allowed_machines: set[str] | None,
) -> list[dict]:
	filters: dict[str, Any] = {"docstatus": 1, "procede": "Offset"}
	if niveau_urgence:
		filters["niveau_urgence"] = niveau_urgence

	fields = [
		"name",
		"machine",
		"date_echeance",
		"date_livraison",
		"date_planification_production",
		"ordre_production",
		"client",
		"article",
		"quantite",
		"quant_feuilles",
		"status",
		"niveau_urgence",
		"demande_faisabilite",
		"procede",
	]
	rows = frappe.get_all("Etude Technique", filters=filters, fields=fields)
	et_names = [r.name for r in rows]

	op_debut_by_name: dict[str, Any] = {}
	op_link_names = {r.get("ordre_production") for r in rows if r.get("ordre_production")}
	if op_link_names:
		for o in frappe.get_all(
			"Ordre de Production",
			filters={"name": ["in", list(op_link_names)]},
			fields=["name", "date_debut_prevue"],
		):
			op_debut_by_name[o.name] = o.get("date_debut_prevue")

	ops_by_et: dict[str, list[dict[str, Any]]] = defaultdict(list)
	if et_names:
		for o in frappe.get_all(
			"Ordre de Production",
			filters={"etude_technique": ["in", et_names]},
			fields=["name", "etude_technique", "date_debut_prevue"],
		):
			ops_by_et[o.etude_technique].append(o)

	def _fallback_op_plan(et_nm: str, op_lk: str | None):
		if op_lk and op_debut_by_name.get(op_lk):
			return op_debut_by_name[op_lk]
		cands = [x.get("date_debut_prevue") for x in ops_by_et.get(et_nm, []) if x.get("date_debut_prevue")]
		return min(cands) if cands else None

	out = []
	for r in rows:
		if (r.get("status") or "") == "Annulée":
			continue
		m = r.get("machine") or ""
		if not _machine_allowed(m or None, allowed_machines):
			continue
		dt_liv = r.get("date_livraison")
		op_plan = _fallback_op_plan(r.name, r.get("ordre_production"))
		dt_plan = r.get("date_planification_production") or op_plan or r.get("date_echeance")
		if temporal_basis == "livraison_client":
			d = dt_liv
		else:
			d = dt_plan
		if d and not (date_from <= getdate(d) <= date_to):
			continue
		st_label = r.get("status") or ""
		out.append(
			{
				"source": "Etude Technique",
				"source_key": "technique",
				"doc_name": r.name,
				"machine": m,
				"stored_plan_date": r.get("date_planification_production"),
				"raw_date": str(d) if d else None,
				"dt_livraison": str(dt_liv) if dt_liv else None,
				"dt_planification": str(dt_plan) if dt_plan else None,
				"client": r.get("client") or "",
				"article": r.get("article") or "",
				"qte_article": r.get("quantite") or 0,
				"qte_feuilles": float(r.get("quant_feuilles") or 0),
				"statut": st_label,
				"status_badge": {
					"label": st_label,
					"indicator": _get_technique_status_indicator(st_label),
				},
				"urgence": r.get("niveau_urgence") or "",
				"demande_faisabilite": r.get("demande_faisabilite") or "",
				"etude_technique": r.name,
				"stage": 2,
			}
		)
	return out


def _build_matrix(jobs: list[dict], granularity: str) -> dict[str, Any]:
	cell_data: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
	machine_ids: set[str] = set()

	for j in jobs:
		mcol = j["machine"] if j["machine"] else UNASSIGNED
		machine_ids.add(mcol)
		bucket = _bucket_date(j.get("raw_date"), granularity)
		dkey = str(bucket) if bucket else NO_DATE_KEY
		# strip non-serializable
		cell_job = {
			"source": j["source"],
			"source_key": j["source_key"],
			"doc_name": j["doc_name"],
			"machine_doc": j.get("machine") or "",
			"stored_plan_date": str(j["stored_plan_date"])
			if j.get("stored_plan_date")
			else None,
			"client_code": j.get("client_code", ""),
			"client_label": j.get("client_label", ""),
			"item_code": j.get("item_code", ""),
			"article_label": j.get("article_label", ""),
			"qte_article": j["qte_article"],
			"qte_feuilles": j["qte_feuilles"],
			"statut": j.get("statut", ""),
			"urgence": j.get("urgence", ""),
			"stage": j["stage"],
			"dt_livraison": j.get("dt_livraison"),
			"dt_planification": j.get("dt_planification"),
			"status_badge": j.get("status_badge"),
		}
		cell_data[dkey][mcol].append(cell_job)

	ordered_machines = sorted([m for m in machine_ids if m != UNASSIGNED])
	if UNASSIGNED in machine_ids:
		ordered_machines.append(UNASSIGNED)

	machine_meta = _machine_meta_entries(ordered_machines)

	date_keys = sorted([k for k in cell_data.keys() if k != NO_DATE_KEY])
	if NO_DATE_KEY in cell_data:
		date_keys.append(NO_DATE_KEY)

	dates_out = [{"key": dk, "label": _date_label(dk, granularity)} for dk in date_keys]

	by_date: dict[str, dict[str, Any]] = {}
	by_machine: dict[str, dict[str, Any]] = defaultdict(lambda: {"jobs": 0, "feuilles": 0.0})
	grand_jobs = 0
	grand_feuilles = 0.0

	cells_out: dict[str, dict[str, Any]] = {}

	for dk in date_keys:
		cells_out[dk] = {}
		row_jobs = 0
		row_feuilles = 0.0
		for m in ordered_machines:
			jlist = cell_data[dk][m]
			nj = len(jlist)
			sf = sum(float(x.get("qte_feuilles") or 0) for x in jlist)
			cells_out[dk][m] = {"jobs": jlist, "job_count": nj, "feuilles_sum": sf}
			row_jobs += nj
			row_feuilles += sf
			by_machine[m]["jobs"] += nj
			by_machine[m]["feuilles"] += sf
		by_date[dk] = {"jobs": row_jobs, "feuilles": row_feuilles}
		grand_jobs += row_jobs
		grand_feuilles += row_feuilles

	return {
		"granularity": granularity,
		"machines": machine_meta,
		"dates": dates_out,
		"cells": cells_out,
		"totals": {
			"by_date": by_date,
			"by_machine": dict(by_machine),
			"grand": {"jobs": grand_jobs, "feuilles": grand_feuilles},
		},
	}


def _planning_charge_validate_machine(machine_name: str | None) -> None:
	"""Machine vide = non affectée ; sinon presse offset (planning)."""
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


@frappe.whitelist()
def update_planning_charge_job(doctype=None, name=None, machine=None, plan_date=None):
	"""Met à jour machine et/ou date de planif. sur document soumis (champs allow_on_submit)."""
	dt = (cstr(doctype) or "").strip()
	nm = (cstr(name) or "").strip()
	if dt not in ("Etude Faisabilite", "Etude Technique") or not nm:
		frappe.throw(_("Document invalide."))

	doc = frappe.get_doc(dt, nm)
	if doc.docstatus == 2:
		frappe.throw(_("Impossible de modifier un document annulé."))

	frappe.has_permission(doc.doctype, "write", doc=doc, throw=True)

	m = (cstr(machine) if machine is not None else "").strip()
	_planning_charge_validate_machine(m or None)

	if plan_date is None or not cstr(plan_date).strip():
		frappe.throw(_("La date de planification est obligatoire."))
	pd = getdate(plan_date)

	if dt == "Etude Faisabilite":
		doc.machine_prevue = m or None
		doc.date_echeance = pd
	else:
		doc.machine = m or None
		doc.date_planification_production = pd

	doc.save()
	return {"ok": True, "message": _("Planification mise à jour.")}


def _build_planning_export_rows(result: dict[str, Any]) -> list[list[Any]]:
	"""Lignes tabulaires (en-tête + données) alignées sur l’export CSV du client."""
	header = [
		str(_("Date")),
		str(_("Machine")),
		str(_("Source")),
		str(_("Statut")),
		str(_("Document")),
		str(_("Code client")),
		str(_("Client")),
		str(_("Code article")),
		str(_("Article")),
		str(_("Qté article")),
		str(_("Qté feuilles")),
		str(_("Date livraison")),
		str(_("Date planif. production")),
		str(_("Urgence")),
	]
	rows: list[list[Any]] = [header]
	machines = result.get("machines") or []
	dates = result.get("dates") or []
	cells = result.get("cells") or {}
	for d in dates:
		dk = d["key"]
		dlabel = d.get("label") or dk
		for m in machines:
			mname = m.get("name")
			mlabel = m.get("label") or mname
			cell = ((cells.get(dk) or {}).get(mname)) or {}
			for j in cell.get("jobs") or []:
				badge = j.get("status_badge") or {}
				lab = badge.get("label") if isinstance(badge, dict) else None
				rows.append(
					[
						dlabel,
						mlabel,
						j.get("source") or "",
						lab or j.get("statut") or "",
						j.get("doc_name") or "",
						j.get("client_code") or "",
						j.get("client_label") or "",
						j.get("item_code") or "",
						j.get("article_label") or "",
						j.get("qte_article"),
						j.get("qte_feuilles"),
						j.get("dt_livraison") or "",
						j.get("dt_planification") or "",
						j.get("urgence") or "",
					]
				)
	return rows


@frappe.whitelist()
def export_planning_charge_excel(
	date_from=None,
	date_to=None,
	temporal_basis=None,
	granularity="day",
	machine=None,
	niveau_urgence=None,
	sources=None,
):
	"""Export .xlsx (mêmes filtres que le planning)."""
	result = get_planning_charge(
		date_from=date_from,
		date_to=date_to,
		temporal_basis=temporal_basis,
		granularity=granularity,
		machine=machine,
		niveau_urgence=niveau_urgence,
		sources=sources,
	)
	rows = _build_planning_export_rows(result)
	if len(rows) <= 1:
		frappe.throw(_("Rien à exporter pour ces filtres."))

	from frappe.desk.utils import provide_binary_file
	from frappe.utils.xlsxutils import make_xlsx

	xlsx_bytes = make_xlsx(rows, str(_("Planning charge machines"))).getvalue()
	provide_binary_file("planning_charge_machines", "xlsx", xlsx_bytes)


@frappe.whitelist()
def get_planning_charge(
	date_from=None,
	date_to=None,
	temporal_basis=None,
	granularity="day",
	machine=None,
	niveau_urgence=None,
	sources=None,
):
	date_from_d = getdate(date_from) if date_from else getdate(add_days(today(), -30))
	date_to_d = getdate(date_to) if date_to else getdate(add_days(today(), 60))
	if date_from_d > date_to_d:
		frappe.throw(_("La date de début est après la date de fin."))

	if (date_to_d - date_from_d).days > 90:
		date_to_d = add_days(date_from_d, 90)
		frappe.msgprint(_("Plage limitée à 90 jours."), indicator="orange")

	tb = _normalize_temporal_basis(temporal_basis)

	granularity = _normalize_granularity(granularity)

	source_set = parse_sources(sources)
	machine_name = (str(machine).strip() if machine else "") or None
	allowed = _allowed_machines_for_query([machine_name] if machine_name else None)

	jobs: list[dict] = []
	if "faisabilite" in source_set:
		jobs.extend(
			_fetch_faisabilite(
				tb,
				date_from_d,
				date_to_d,
				niveau_urgence,
				allowed,
			)
		)
	if "technique" in source_set:
		jobs.extend(_fetch_technique(tb, date_from_d, date_to_d, niveau_urgence, allowed))

	# Un seul affichage par fil : si une étude technique existe pour la demande, la ligne faisabilité est retirée.
	jobs = _deduplicate_jobs(jobs)

	_hydrate_labels(jobs)

	result = _build_matrix(jobs, granularity)
	tb_label = str(_("Livraison")) if tb == "livraison_client" else str(_("Planification"))
	result["meta"] = {
		"date_from": str(date_from_d),
		"date_to": str(date_to_d),
		"temporal_basis": tb,
		"temporal_basis_label": tb_label,
		"sources": sorted(source_set),
		"scope": "offset_presse",
	}
	return result
