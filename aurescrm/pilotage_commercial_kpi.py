# Copyright (c) 2025, Medigo and contributors
# For license information, please see license.txt
"""
Calculs KPI pour Pilotage Commercial.

Sources canoniques (alignement avec l'app) :
- Portefeuille : Customer.custom_commercial_attribué + tabCustomer Commercial Assignment
- CA : Sales Invoice (docstatus=1, base_net_total)
- Visites : Visite Commerciale (docstatus=1, utilisateur, date)

Datasets utiles pour Frappe Insights : tabPilotage Commercial, tabPilotage Commercial Snapshot,
tabCustomer, tabVisite Commerciale, tabSales Invoice.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import frappe
from frappe.utils import flt, get_datetime, get_first_day, get_last_day, getdate, now_datetime


def get_portfolio_customer_names(user: str) -> set[str]:
	"""Clients attribués au commercial (legacy + table enfant)."""
	if not user:
		return set()
	legacy = set(
		frappe.get_all(
			"Customer",
			filters={"custom_commercial_attribué": user},
			pluck="name",
		)
	)
	child_rows = frappe.db.sql(
		"""
		select distinct parent from `tabCustomer Commercial Assignment`
		where commercial = %s
		""",
		user,
	)
	child = {r[0] for r in child_rows if r[0]}
	return legacy | child


def month_bounds(d: date | None = None) -> tuple[date, date]:
	d = d or getdate()
	return get_first_day(d), get_last_day(d)


def sum_revenue_for_customers(
	customer_names: set[str], start_date: date, end_date: date
) -> float:
	if not customer_names:
		return 0.0
	customers = list(customer_names)
	total = 0.0
	chunk_size = 400
	for i in range(0, len(customers), chunk_size):
		chunk = customers[i : i + chunk_size]
		ph = ",".join(["%s"] * len(chunk))
		row = frappe.db.sql(
			f"""
			select sum(si.base_net_total)
			from `tabSales Invoice` si
			where si.docstatus = 1
				and si.posting_date between %s and %s
				and si.customer in ({ph})
			""",
			tuple([start_date, end_date, *chunk]),
		)
		total += flt(row[0][0] if row and row[0][0] is not None else 0)
	return total


def count_visits(user: str, start_date: date, end_date: date) -> int:
	if not user:
		return 0
	return frappe.db.count(
		"Visite Commerciale",
		{
			"utilisateur": user,
			"docstatus": 1,
			"date": ["between", [start_date, end_date]],
		},
	)


def count_customers_with_filters(customer_names: set[str], filters: dict[str, Any]) -> int:
	if not customer_names:
		return 0
	return frappe.db.count(
		"Customer",
		{"name": ["in", list(customer_names)], **filters},
	)


def count_distinct_visited_active(
	user: str, start_date: date, end_date: date, active_customers: list[str]
) -> int:
	if not user or not active_customers:
		return 0
	chunk_size = 400
	total = 0
	for i in range(0, len(active_customers), chunk_size):
		chunk = active_customers[i : i + chunk_size]
		ph = ",".join(["%s"] * len(chunk))
		row = frappe.db.sql(
			f"""
			select count(distinct vc.client)
			from `tabVisite Commerciale` vc
			where vc.utilisateur = %s
				and vc.docstatus = 1
				and vc.date between %s and %s
				and vc.client in ({ph})
			""",
			tuple([user, start_date, end_date, *chunk]),
		)
		total += int(row[0][0] or 0)
	return total


def count_new_active_customers_in_period(
	customer_names: set[str], start_dt: datetime, end_dt: datetime
) -> int:
	if not customer_names:
		return 0
	return frappe.db.count(
		"Customer",
		{
			"name": ["in", list(customer_names)],
			"custom_status": "Actif",
			"creation": ["between", [start_dt, end_dt]],
		},
	)


def count_prospects_with_visit_in_period(
	user: str, customer_names: set[str], start_date: date, end_date: date
) -> int:
	if not user or not customer_names:
		return 0
	prospects = frappe.get_all(
		"Customer",
		filters={"name": ["in", list(customer_names)], "custom_status": "Prospect"},
		pluck="name",
	)
	if not prospects:
		return 0
	chunk_size = 400
	count = 0
	for i in range(0, len(prospects), chunk_size):
		chunk = prospects[i : i + chunk_size]
		ph = ",".join(["%s"] * len(chunk))
		row = frappe.db.sql(
			f"""
			select count(distinct vc.client)
			from `tabVisite Commerciale` vc
			where vc.utilisateur = %s
				and vc.docstatus = 1
				and vc.date between %s and %s
				and vc.client in ({ph})
			""",
			tuple([user, start_date, end_date, *chunk]),
		)
		count += int(row[0][0] or 0)
	return count


def compute_monthly_kpis(user: str, ref_date: date | None = None) -> dict[str, Any]:
	"""Agrégats pour le mois calendaire de ref_date."""
	ref_date = ref_date or getdate()
	start_d, end_d = month_bounds(ref_date)
	start_dt = get_datetime(f"{start_d} 00:00:00")
	end_dt = get_datetime(f"{end_d} 23:59:59")

	portfolio = get_portfolio_customer_names(user)
	portfolio_n = len(portfolio)
	strategic_n = count_customers_with_filters(portfolio, {"custom_grand_compte": 1})
	active_n = count_customers_with_filters(portfolio, {"custom_status": "Actif"})
	active_list = frappe.get_all(
		"Customer",
		filters={"name": ["in", list(portfolio)], "custom_status": "Actif"},
		pluck="name",
	)

	revenue = sum_revenue_for_customers(portfolio, start_d, end_d)
	visits = count_visits(user, start_d, end_d)

	covered = count_distinct_visited_active(user, start_d, end_d, active_list)
	coverage_rate = min(100.0, flt(covered) / flt(active_n) * 100.0) if active_n else 0.0

	new_actifs = count_new_active_customers_in_period(portfolio, start_dt, end_dt)
	prospects_followed = count_prospects_with_visit_in_period(user, portfolio, start_d, end_d)
	if prospects_followed:
		conversion_rate = min(100.0, flt(new_actifs) / flt(prospects_followed) * 100.0)
	else:
		conversion_rate = 0.0

	dormant_n = count_customers_with_filters(portfolio, {"custom_status": "Dormant"})

	return {
		"period_start": start_d,
		"period_end": end_d,
		"period_label": ref_date.strftime("%Y-%m"),
		"portfolio_accounts_count": portfolio_n,
		"strategic_accounts_count": strategic_n,
		"active_customers_count": active_n,
		"revenue_achieved": revenue,
		"visits_completed": visits,
		"coverage_rate": coverage_rate,
		"conversion_rate": conversion_rate,
		"new_active_customers": new_actifs,
		"prospects_followed": prospects_followed,
		"dormant_customers_count": dormant_n,
	}


def weekly_preparation_to_score(status: str | None) -> float:
	if not status:
		return 50.0
	m = {"A jour": 100.0, "Partielle": 60.0, "En retard": 20.0}
	return m.get(status, 50.0)


def compute_crm_discipline_score(
	weekly_status: str | None, process_score: float | None, visits: int, visit_target: float
) -> float:
	w = weekly_preparation_to_score(weekly_status)
	p = flt(process_score) if process_score is not None else 70.0
	if visit_target and visit_target > 0:
		v = min(100.0, flt(visits) / flt(visit_target) * 100.0)
	else:
		v = 50.0 if visits else 0.0
	return min(100.0, (w * 0.35 + p * 0.35 + v * 0.30))


def compute_priority_score(
	target_achievement_pct: float,
	strategic_accounts_count: int,
	dormant_customers_count: float,
	crm_discipline_score: float,
	open_critical_actions: int,
) -> float:
	"""Score managérial : plus élevé = plus d'attention requise."""
	p = 0.0
	ta = flt(target_achievement_pct)
	if ta < 70:
		p += (70 - min(ta, 70)) * 0.8
	p += min(30.0, flt(strategic_accounts_count) * 1.5)
	p += min(25.0, flt(dormant_customers_count) * 2.0)
	if crm_discipline_score < 60:
		p += (60 - crm_discipline_score) * 0.5
	p += min(20.0, open_critical_actions * 5.0)
	return min(100.0, p)


def priority_level_from_score(score: float) -> str:
	if score >= 70:
		return "Critique"
	if score >= 45:
		return "Haute"
	if score >= 20:
		return "Normale"
	return "Basse"


def refresh_pilotage_kpis(doc_name: str, *, append_snapshot: bool = True) -> None:
	doc = frappe.get_doc("Pilotage Commercial", doc_name)
	kpis = compute_monthly_kpis(doc.user)

	doc.portfolio_accounts_count = kpis["portfolio_accounts_count"]
	doc.strategic_accounts_count = kpis["strategic_accounts_count"]
	doc.active_customers_count = kpis["active_customers_count"]
	doc.revenue_achieved = kpis["revenue_achieved"]
	doc.visits_completed = kpis["visits_completed"]
	doc.coverage_rate = kpis["coverage_rate"]
	doc.conversion_rate = kpis["conversion_rate"]
	doc.portfolio_last_sync_at = now_datetime()

	month_start = kpis["period_start"]
	month_end = kpis["period_end"]
	today = getdate()

	# Objectifs : lignes du mois courant
	monthly_revenue_target = 0.0
	visit_target = 0.0
	new_cust_target = 0.0
	coverage_target = 0.0
	conversion_target = 0.0

	for row in doc.targets:
		if row.is_locked:
			continue
		if not (row.period_start and row.period_end):
			continue
		ps = getdate(row.period_start)
		pe = getdate(row.period_end)
		if not (ps <= today <= pe):
			continue
		tgt = flt(row.target_value)
		if row.metric_code == "revenue" and row.period_type == "Monthly":
			monthly_revenue_target = tgt
			ach = kpis["revenue_achieved"]
			row.achieved_value = ach
			row.achievement_pct = (ach / tgt * 100.0) if tgt else 0.0
		elif row.metric_code == "visits" and row.period_type == "Monthly":
			visit_target = tgt
			ach = float(kpis["visits_completed"])
			row.achieved_value = ach
			row.achievement_pct = (ach / tgt * 100.0) if tgt else 0.0
		elif row.metric_code == "new_customers" and row.period_type == "Monthly":
			new_cust_target = tgt
			ach = float(kpis["new_active_customers"])
			row.achieved_value = ach
			row.achievement_pct = (ach / tgt * 100.0) if tgt else 0.0
		elif row.metric_code == "coverage" and row.period_type == "Monthly":
			coverage_target = tgt
			ach = kpis["coverage_rate"]
			row.achieved_value = ach
			row.achievement_pct = (ach / tgt * 100.0) if tgt else 0.0
		elif row.metric_code == "conversion" and row.period_type == "Monthly":
			conversion_target = tgt
			ach = kpis["conversion_rate"]
			row.achieved_value = ach
			row.achievement_pct = (ach / tgt * 100.0) if tgt else 0.0

	doc.monthly_revenue_target = monthly_revenue_target
	doc.visit_target_current = int(visit_target) if visit_target else 0
	doc.new_customers_target_current = int(new_cust_target) if new_cust_target else 0

	# Objectif annuel revenue (ligne Yearly englobant today)
	annual_tgt = 0.0
	for row in doc.targets:
		if row.metric_code != "revenue" or row.period_type != "Yearly":
			continue
		if not (row.period_start and row.period_end):
			continue
		ps = getdate(row.period_start)
		pe = getdate(row.period_end)
		if ps <= today <= pe:
			annual_tgt = flt(row.target_value)
			y_start, y_end = ps, pe
			ach_y = sum_revenue_for_customers(
				get_portfolio_customer_names(doc.user), y_start, y_end
			)
			if not row.is_locked:
				row.achieved_value = ach_y
				row.achievement_pct = (ach_y / annual_tgt * 100.0) if annual_tgt else 0.0
			break
	doc.annual_revenue_target = annual_tgt

	# % atteinte principal : revenue mensuel si défini, sinon moyenne des lignes mensuelles actives
	if monthly_revenue_target:
		doc.target_achievement_pct = (
			(flt(doc.revenue_achieved) / monthly_revenue_target * 100.0)
			if monthly_revenue_target
			else 0.0
		)
	else:
		pcts = [
			flt(r.achievement_pct)
			for r in doc.targets
			if r.period_type == "Monthly"
			and r.period_start
			and r.period_end
			and getdate(r.period_start) <= today <= getdate(r.period_end)
		]
		doc.target_achievement_pct = sum(pcts) / len(pcts) if pcts else 0.0

	rev_ach_pct = doc.target_achievement_pct
	vis_ach_pct = (
		(flt(kpis["visits_completed"]) / visit_target * 100.0) if visit_target else 0.0
	)
	new_ach_pct = (
		(flt(kpis["new_active_customers"]) / new_cust_target * 100.0)
		if new_cust_target
		else 0.0
	)
	cov_ach_pct = (
		(flt(kpis["coverage_rate"]) / coverage_target * 100.0) if coverage_target else flt(kpis["coverage_rate"])
	)

	doc.crm_discipline_score = compute_crm_discipline_score(
		doc.weekly_preparation_status,
		doc.process_compliance_score,
		kpis["visits_completed"],
		visit_target,
	)

	open_critical = sum(
		1
		for a in doc.actions
		if a.status not in ("Terminée", "Annulée")
		and a.priority in ("Critique", "Haute")
		and a.due_date
		and getdate(a.due_date) < today
	)

	doc.priority_score = compute_priority_score(
		rev_ach_pct,
		int(kpis["strategic_accounts_count"]),
		float(kpis["dormant_customers_count"]),
		flt(doc.crm_discipline_score),
		open_critical,
	)
	doc.priority_level = priority_level_from_score(doc.priority_score)

	doc.stats_last_refresh_at = now_datetime()

	if append_snapshot:
		_snap_append_or_update(doc, kpis)

	doc.save(ignore_permissions=True)


def _snap_append_or_update(doc, kpis: dict[str, Any]) -> None:
	today = getdate()
	label = kpis["period_label"]
	found = None
	for row in doc.snapshots:
		if getdate(row.snapshot_date) == today and row.period_label == label:
			found = row
			break
	payload = {
		"snapshot_date": today,
		"period_label": label,
		"period_type": "Monthly",
		"revenue_achieved": kpis["revenue_achieved"],
		"target_achievement_pct": doc.target_achievement_pct,
		"visits_completed": kpis["visits_completed"],
		"coverage_rate": kpis["coverage_rate"],
		"conversion_rate": kpis["conversion_rate"],
		"portfolio_accounts_count": kpis["portfolio_accounts_count"],
		"strategic_accounts_count": kpis["strategic_accounts_count"],
		"active_customers_count": kpis["active_customers_count"],
	}
	if found:
		for k, v in payload.items():
			setattr(found, k, v)
	else:
		doc.append("snapshots", payload)


def refresh_all_pilotage_kpis():
	"""Tâche planifiée : recalcul de toutes les fiches actives."""
	names = frappe.get_all(
		"Pilotage Commercial",
		filters={"record_status": ["!=", "Archivé"]},
		pluck="name",
	)
	for name in names:
		try:
			refresh_pilotage_kpis(name, append_snapshot=True)
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Pilotage KPI refresh failed: {name}")
