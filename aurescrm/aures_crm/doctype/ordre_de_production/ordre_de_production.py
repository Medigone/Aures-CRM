# Copyright (c) 2025, AURES Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, get_datetime, time_diff_in_hours, flt, format_datetime


class OrdredeProduction(Document):
	def validate(self):
		"""Validations et calculs avant sauvegarde"""
		pass
	
	def before_save(self):
		"""Calculs automatiques avant sauvegarde"""
		# Récupérer les données depuis les opérations indépendantes
		self.calculer_quantites_depuis_operations()
		self.calculer_dates_depuis_operations()
		self.verifier_statut_depuis_operations()
		self.calculer_temps_total()
		self.set_color_indicator()
	
	def after_save(self):
		"""Actions après sauvegarde"""
		# Mettre à jour le dashboard HTML
		self.mettre_a_jour_dashboard()
	
	def on_submit(self):
		"""Actions lors de la soumission"""
		pass
	
	def get_operations(self):
		"""Récupérer toutes les opérations de cet ordre"""
		return frappe.get_all("Operation Production",
			filters={"ordre_production": self.name},
			fields=["*"],
			order_by="numero_sequence asc"
		)
	
	def get_operations_list(self):
		"""Liste détaillée avec objets doc"""
		return frappe.get_list("Operation Production",
			filters={"ordre_production": self.name},
			fields=[
				"name", "nom_operation", "statut", "operateur_assigne", 
				"date_heure_prevue_debut", "date_heure_prevue_fin",
				"date_heure_debut_reelle", "date_heure_fin_reelle",
				"duree_reelle", "duree_estimee", "est_en_retard", 
				"probleme_signale", "quantite_ok", "quantite_rebutee",
				"quantite_traitee", "numero_passage", "total_passages"
			],
			order_by="numero_sequence asc"
		)
	
	def calculer_quantites_depuis_operations(self):
		"""Calculer les quantités produites et rebutées depuis les opérations"""
		operations = self.get_operations()
		
		if operations:
			self.quantite_produite = sum(op.get("quantite_ok") or 0 for op in operations)
			self.quantite_rebutee = sum(op.get("quantite_rebutee") or 0 for op in operations)
			
			# Calculer le taux de rebut
			total_traite = sum(op.get("quantite_traitee") or 0 for op in operations)
			if total_traite > 0:
				self.taux_rebut = (self.quantite_rebutee / total_traite) * 100
			else:
				self.taux_rebut = 0
		else:
			self.quantite_produite = 0
			self.quantite_rebutee = 0
			self.taux_rebut = 0
	
	def calculer_dates_depuis_operations(self):
		"""Calculer les dates réelles depuis les opérations"""
		operations = self.get_operations()
		
		if operations:
			# Date début réelle = date de début de la première opération démarrée
			operations_demarrees = [op for op in operations if op.get("date_heure_debut_reelle")]
			if operations_demarrees:
				self.date_debut_reelle = min(op.get("date_heure_debut_reelle") for op in operations_demarrees)
			
			# Date fin réelle = date de fin de la dernière opération si toutes sont terminées
			operations_terminees = [op for op in operations if op.get("date_heure_fin_reelle")]
			if operations_terminees and len(operations_terminees) == len(operations):
				self.date_fin_reelle = max(op.get("date_heure_fin_reelle") for op in operations_terminees)
	
	def verifier_statut_depuis_operations(self):
		"""Mettre à jour le statut selon l'état des opérations"""
		operations = self.get_operations()
		
		if not operations:
			return
		
		# Vérifier les statuts des opérations
		statuts = [op.get("statut") for op in operations]
		
		if all(s == "Terminée" for s in statuts):
			self.status = "Terminé"
			self.etape_actuelle = "Terminé"
		elif any(s == "En cours" for s in statuts):
			self.status = "En Production"
			# Trouver l'étape en cours
			for op in operations:
				if op.get("statut") == "En cours":
					self.etape_actuelle = op.get("nom_operation")
					break
		elif any(s == "En pause" for s in statuts):
			self.status = "En Pause"
		elif any(s == "Bloquée" for s in statuts):
			# Ne pas changer le statut mais noter l'étape actuelle
			for op in operations:
				if op.get("statut") == "Bloquée":
					self.etape_actuelle = f"Bloquée: {op.get('nom_operation')}"
					break
		elif any(s == "Assignée" for s in statuts):
			if self.status == "Nouveau":
				self.status = "Planifié"
	
	def calculer_temps_total(self):
		"""Calculer le temps total de production"""
		if self.date_debut_reelle and self.date_fin_reelle:
			self.temps_total_production = time_diff_in_hours(
				get_datetime(self.date_fin_reelle),
				get_datetime(self.date_debut_reelle)
			)
	
	def set_color_indicator(self):
		"""Définir l'indicateur de couleur basé sur la priorité et le statut"""
		if self.status == "Terminé":
			self.color_indicator = "Green"
		elif self.status == "Annulé":
			self.color_indicator = "Grey"
		elif self.status == "En Pause":
			self.color_indicator = "Orange"
		elif self.priorite == "Très Urgente":
			self.color_indicator = "Red"
		elif self.priorite == "Urgente":
			self.color_indicator = "Orange"
		else:
			self.color_indicator = "Blue"
	
	def mettre_a_jour_dashboard(self):
		"""Mettre à jour le champ HTML du dashboard"""
		try:
			html = self.get_dashboard_html()
			if html != self.dashboard_operations:
				frappe.db.set_value("Ordre de Production", self.name, "dashboard_operations", html, update_modified=False)
		except Exception as e:
			frappe.log_error(f"Erreur dashboard: {str(e)}")
	
	@frappe.whitelist()
	def generer_operations_depuis_route(self):
		"""Générer les opérations depuis la route de production"""
		# Vérifier qu'il n'y a pas déjà des opérations
		if frappe.db.exists("Operation Production", {"ordre_production": self.name}):
			frappe.throw("Des opérations existent déjà pour cet ordre")
		
		if not self.route_production:
			frappe.throw("Veuillez sélectionner une route de production")
		
		route = frappe.get_doc("Route de Production", self.route_production)
		
		if not route.etapes:
			frappe.throw("La route de production ne contient aucune étape")
		
		operations_creees = 0
		
		for idx, etape_route in enumerate(sorted(route.etapes, key=lambda x: x.ordre), 1):
			nb_passages = etape_route.nombre_passages or 1
			
			for passage in range(1, nb_passages + 1):
				nom_op = etape_route.nom_etape
				if nb_passages > 1:
					nom_op += f" - Passage {passage}"
				
				# Créer l'opération
				operation = frappe.get_doc({
					"doctype": "Operation Production",
					"ordre_production": self.name,
					"type_operation": etape_route.get("type_operation") if etape_route.get("type_operation") else None,
					"numero_sequence": idx + (passage - 1) * 0.1,
					"nom_operation": nom_op,
					"numero_passage": passage if nb_passages > 1 else None,
					"total_passages": nb_passages if nb_passages > 1 else None,
					"workstation": etape_route.workstation,
					"duree_estimee": etape_route.duree_estimee,
					"quantite_prevue": self.quantite_a_produire,
					"statut": "En attente"
				})
				operation.insert()
				operations_creees += 1
		
		# Mettre à jour le statut de l'ordre
		self.status = "Planifié"
		self.save()
		
		frappe.msgprint(
			f"{operations_creees} opération(s) générée(s) avec succès",
			indicator="green",
			alert=True
		)
		
		return True
	
	@frappe.whitelist()
	def calculer_progression(self):
		"""Calculer le pourcentage de progression"""
		operations = self.get_operations()
		
		if not operations:
			return 0
		
		total_ops = len(operations)
		ops_terminees = sum(1 for op in operations if op.get("statut") == "Terminée")
		
		progression = (ops_terminees / total_ops) * 100
		return round(progression, 2)
	
	@frappe.whitelist()
	def get_dashboard_html(self):
		"""Générer le HTML pour le dashboard temps réel"""
		operations = self.get_operations_list()
		
		if not operations:
			return '''
			<div style="padding: 20px; text-align: center; color: #999;">
				<p>Aucune opération générée.</p>
				<p>Utilisez le bouton <strong>"Générer Opérations"</strong> pour créer les opérations depuis la route de production.</p>
			</div>
			'''
		
		# Calculs
		total_ops = len(operations)
		ops_terminees = sum(1 for op in operations if op.get("statut") == "Terminée")
		ops_en_cours = sum(1 for op in operations if op.get("statut") == "En cours")
		ops_bloquees = sum(1 for op in operations if op.get("statut") == "Bloquée")
		ops_en_retard = sum(1 for op in operations if op.get("est_en_retard"))
		progression = (ops_terminees / total_ops * 100) if total_ops > 0 else 0
		
		# HTML avec alertes
		html = f'''
		<div style="padding: 15px;">
			{self._render_alertes(ops_bloquees, ops_en_retard)}
			
			<!-- Progression -->
			<div style="margin-bottom: 20px;">
				<h4>Progression: {progression:.1f}% 
					<small>({ops_terminees}/{total_ops} opérations)</small>
				</h4>
				<div class="progress" style="height: 25px;">
					<div class="progress-bar progress-bar-success" role="progressbar" 
					     style="width: {progression}%;">{progression:.0f}%</div>
				</div>
			</div>
			
			<!-- Stats rapides -->
			<div class="row" style="margin-bottom: 20px;">
				<div class="col-xs-3">
					<div class="alert alert-info" style="margin-bottom: 0; padding: 10px; text-align: center;">
						<h3 style="margin: 0;">{ops_en_cours}</h3>
						<small>En cours</small>
					</div>
				</div>
				<div class="col-xs-3">
					<div class="alert alert-warning" style="margin-bottom: 0; padding: 10px; text-align: center;">
						<h3 style="margin: 0;">{ops_en_retard}</h3>
						<small>En retard</small>
					</div>
				</div>
				<div class="col-xs-3">
					<div class="alert alert-danger" style="margin-bottom: 0; padding: 10px; text-align: center;">
						<h3 style="margin: 0;">{ops_bloquees}</h3>
						<small>Bloquées</small>
					</div>
				</div>
				<div class="col-xs-3">
					<div class="alert alert-success" style="margin-bottom: 0; padding: 10px; text-align: center;">
						<h3 style="margin: 0;">{ops_terminees}</h3>
						<small>Terminées</small>
					</div>
				</div>
			</div>
			
			<!-- Tableau détaillé -->
			{self._render_tableau_operations(operations)}
		</div>
		'''
		
		return html
	
	def _render_alertes(self, ops_bloquees, ops_en_retard):
		"""Rendre les alertes HTML"""
		alertes = []
		if ops_bloquees > 0:
			alertes.append(f'<div class="alert alert-danger"><strong>🚨 URGENT :</strong> {ops_bloquees} opération(s) bloquée(s) !</div>')
		if ops_en_retard > 0:
			alertes.append(f'<div class="alert alert-warning"><strong>⚠️ ATTENTION :</strong> {ops_en_retard} opération(s) en retard !</div>')
		return ''.join(alertes)
	
	def _render_tableau_operations(self, operations):
		"""Rendre le tableau des opérations"""
		html = '''
		<table class="table table-bordered table-hover" style="margin-top: 20px;">
			<thead style="background-color: #f8f9fa;">
				<tr>
					<th width="5%">#</th>
					<th width="25%">Opération</th>
					<th width="12%">Statut</th>
					<th width="15%">Opérateur</th>
					<th width="18%">Dates Prévues</th>
					<th width="15%">Durée</th>
					<th width="10%">Quantités</th>
				</tr>
			</thead>
			<tbody>
		'''
		
		for idx, op in enumerate(operations, 1):
			# Couleur selon statut
			couleur_map = {
				"En attente": "#6c757d",
				"Assignée": "#17a2b8",
				"En cours": "#007bff",
				"Terminée": "#28a745",
				"En pause": "#ffc107",
				"Bloquée": "#dc3545"
			}
			couleur = couleur_map.get(op.get("statut"), "#999")
			
			# Badge statut
			badge = f'<span style="background: {couleur}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold;">{op.get("statut")}</span>'
			
			# Badge en retard
			if op.get("est_en_retard"):
				badge += ' <span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 8px; font-size: 10px;">⏰</span>'
			
			# Passage info
			passage_info = ""
			if op.get("total_passages") and op.get("total_passages") > 1:
				passage_info = f" <small style='color: #999;'>(P{op.get('numero_passage')}/{op.get('total_passages')})</small>"
			
			# Opérateur
			operateur = op.get("operateur_assigne") or "-"
			
			# Dates prévues
			dates_info = ""
			if op.get("date_heure_prevue_debut"):
				dates_info = f"<small>{format_datetime(op.get('date_heure_prevue_debut'), 'dd/MM HH:mm')}</small>"
			
			# Durée
			duree_info = ""
			if op.get("duree_reelle"):
				duree_info = f"<strong>{op.get('duree_reelle'):.1f}h</strong>"
				if op.get("duree_estimee"):
					ecart = op.get("duree_reelle") - op.get("duree_estimee")
					couleur_ecart = "#28a745" if ecart <= 0 else "#dc3545"
					duree_info += f'<br/><small style="color: {couleur_ecart};">({ecart:+.1f}h)</small>'
			elif op.get("duree_estimee"):
				duree_info = f"<small>~{op.get('duree_estimee'):.1f}h</small>"
			
			# Quantités
			qte_info = ""
			if op.get("quantite_traitee"):
				qte_ok = op.get("quantite_ok") or 0
				qte_rebut = op.get("quantite_rebutee") or 0
				qte_info = f"<small>✓{qte_ok}"
				if qte_rebut > 0:
					qte_info += f"<br/>✗{qte_rebut}</small>"
				else:
					qte_info += "</small>"
			
			# Lien vers l'opération
			nom_op = op.get("nom_operation") or ""
			lien_op = f'<a href="/app/operation-production/{op.get("name")}" target="_blank">{nom_op}</a>{passage_info}'
			
			html += f'''
			<tr style="{'background-color: #fff3cd;' if op.get('est_en_retard') else ''}">
				<td style="text-align: center;"><strong>{idx}</strong></td>
				<td>{lien_op}</td>
				<td>{badge}</td>
				<td><small>{operateur}</small></td>
				<td>{dates_info}</td>
				<td>{duree_info}</td>
				<td style="text-align: center;">{qte_info}</td>
			</tr>
			'''
		
		html += '''
			</tbody>
		</table>
		'''
		
		return html


@frappe.whitelist()
def create_ordre_production(etude_name):
	"""Créer un ordre de production depuis une étude technique"""
	try:
		etude = frappe.get_doc("Etude Technique", etude_name)
		
		# Vérifications
		if etude.ordre_production:
			frappe.throw("Un ordre de production existe déjà pour cette étude")
		
		if etude.docstatus != 1:
			frappe.throw("L'étude technique doit être soumise avant de créer un ordre")
		
		# Déterminer la route selon le procédé
		route = frappe.db.get_value(
			"Route de Production",
			{"procede": etude.procede, "is_active": 1},
			"name"
		)
		
		if not route:
			frappe.throw(f"Aucune route de production active trouvée pour le procédé {etude.procede}")
		
		# Créer l'ordre
		ordre = frappe.get_doc({
			"doctype": "Ordre de Production",
			"etude_technique": etude.name,
			"sales_order": etude.commande,
			"client": etude.client,
			"article": etude.article,
			"bat": etude.bat,
			"quantite_a_produire": etude.quantite,
			"route_production": route,
			"statut": "Nouveau",
			"priorite": "Normale"
		})
		
		ordre.insert()
		
		# Générer automatiquement les opérations
		ordre.generer_operations_depuis_route()
		
		# Lier l'ordre à l'étude
		frappe.db.set_value("Etude Technique", etude.name, "ordre_production", ordre.name)
		frappe.db.commit()
		
		frappe.msgprint(
			f"Ordre de production {ordre.name} créé avec {len(ordre.get_operations())} opérations",
			indicator="green"
		)
		
		return ordre.name
		
	except Exception as e:
		frappe.log_error(f"Erreur lors de la création de l'ordre de production: {str(e)}")
		frappe.throw(str(e))
