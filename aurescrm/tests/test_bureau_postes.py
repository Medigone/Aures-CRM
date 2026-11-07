# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
import json
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from aurescrm import item_cotations
from aurescrm.api import bureau, bureau_atelier, bureau_clients, bureau_demandes, bureau_etudes, bureau_etudes_accueil, bureau_etudes_pieces, bureau_postes


class TestPostes(FrappeTestCase):
	def _keys(self, *roles):
		with patch("frappe.get_roles", return_value=list(roles)):
			return [poste["key"] for poste in bureau_postes.get_postes("x@example.com")]

	def test_invite_sans_poste(self):
		self.assertEqual(bureau_postes.get_postes("Guest"), [])
		self.assertEqual(bureau_postes.get_droits("Guest"), {})

	def test_roles_back_office(self):
		for role in ("Administrateur Ventes", "Chargé Devis", "Responsable Devis"):
			self.assertEqual(self._keys(role), ["back_office"])

	def test_acces_complet_voit_les_postes_ouverts(self):
		self.assertEqual(self._keys("System Manager"), ["back_office", "etude"])

	def test_poste_ouvert_compte_ses_roles(self):
		self.assertEqual(self._keys("Étude Flexo"), ["etude"])
		self.assertEqual(self._keys("Administrateur Ventes", "Étude Flexo"), ["back_office", "etude"])
		with patch("frappe.get_roles", return_value=["Chargé Étude Faisabilité"]):
			self.assertTrue(bureau.can_access_bureau("x@example.com"))

	def test_poste_ferme_ne_compte_pas(self):
		etude = {**bureau_postes.POSTES["etude"], "ouvert": False}
		with patch.dict(bureau_postes.POSTES, {"etude": etude}):
			self.assertEqual(self._keys("Étude Flexo"), [])

	def test_droits_de_l_administrateur(self):
		droits = bureau_postes.get_droits("Administrator")
		self.assertEqual(set(droits), set(bureau_postes.DOCTYPES_INTERFACE))
		self.assertTrue(all(droit["read"] for droit in droits.values()))


class TestDroitsEtude(FrappeTestCase):
	def _fixture(self, name):
		with open(frappe.get_app_path("aurescrm", "fixtures", name), encoding="utf-8") as handle:
			return json.load(handle)

	def test_fixture_responsable_lit_le_referentiel(self):
		rows = [row for row in self._fixture("custom_docperm.json") if row["role"] == "Responsable Étude Faisabilité" and row["parent"] in ("Customer", "Item")]
		self.assertEqual(sorted(row["parent"] for row in rows), ["Customer", "Item"])
		self.assertTrue(all(row["read"] == 1 and row["write"] == 0 and row["create"] == 0 for row in rows))

	def test_fixture_workflow_flexo(self):
		workflow = next(row for row in self._fixture("workflow.json") if row["name"] == "Etude Faisabilite Flexo")
		self.assertEqual({row["allowed"] for row in workflow["transitions"]}, {"Étude Flexo"})

	def test_sans_droit_pas_de_solde(self):
		with patch.object(bureau_clients, "_readable", return_value=False):
			self.assertEqual(bureau_clients._soldes(), {})
			self.assertEqual(bureau_clients._last_visits(), {})
			self.assertEqual(bureau_clients._open_tickets(), {})
			self.assertEqual(bureau_clients._tickets("CLI-X"), [])

	def test_etudes_d_une_demande_selon_le_droit(self):
		with patch.object(bureau_demandes.frappe, "has_permission", return_value=False), patch.object(bureau_demandes.frappe, "get_all", side_effect=AssertionError("lecture sans droit")):
			self.assertEqual(bureau_demandes._etudes("DF-X"), [])


class TestEtudes(FrappeTestCase):
	def _row(self, name, status="En étude", urgence="U0", echeance=None, creation="2026-01-01"):
		return {"name": name, "status": status, "urgence": urgence, "echeance": echeance, "creation": creation, "retard": False}

	def test_retard_seulement_sur_une_etude_ouverte(self):
		self.assertTrue(bureau_etudes.is_late("En étude", "2026-01-01", "2026-01-02"))
		self.assertFalse(bureau_etudes.is_late("En étude", "2026-01-02", "2026-01-02"))
		self.assertFalse(bureau_etudes.is_late("Réalisable", "2026-01-01", "2026-01-02"))
		self.assertFalse(bureau_etudes.is_late("En étude", None, "2026-01-02"))

	def test_ordre_par_defaut(self):
		rows = [
			self._row("C", status="Réalisable", creation="2026-03-01"),
			self._row("D", status="Annulée", creation="2026-04-01"),
			self._row("B", urgence="U0", echeance="2026-01-01"),
			self._row("A", urgence="U3", echeance="2026-06-01"),
		]
		self.assertEqual([row["name"] for row in bureau_etudes.order_etudes(rows)], ["A", "B", "D", "C"])

	def test_tri_numerique_et_valeur_vide_a_la_fin(self):
		rows = [{"name": "A", "quantite": 9}, {"name": "B", "quantite": 100}, {"name": "C", "quantite": ""}]
		self.assertEqual([row["name"] for row in bureau_etudes.order_etudes(rows, "quantite", "desc")], ["B", "A", "C"])

	def test_filtre_reecrit_pour_l_autre_document(self):
		filters = [[bureau_etudes.OFFSET, "status", "=", "En étude"]]
		self.assertEqual(bureau_etudes._filters_for(filters, bureau_etudes.FLEXO), [[bureau_etudes.FLEXO, "status", "=", "En étude"]])
		self.assertIsNone(bureau_etudes._filters_for([[bureau_etudes.OFFSET, "imposition", "=", "X"]], bureau_etudes.FLEXO))

	def test_administrateur_voit_les_deux_documents(self):
		response = bureau_etudes.get_etudes(page_length=500)
		self.assertEqual({row["doctype"] for row in response["etudes"]} - set(bureau_etudes.ETUDES), set())
		self.assertEqual(response["counts"]["all"], response["total"])
		self.assertGreaterEqual(response["counts"]["traiter"], response["counts"]["retard"])

	def test_vue_mes_etudes_seulement_ouvertes(self):
		self.assertTrue(bureau_etudes.in_view("mine", {"mine": True, "status": "En étude"}))
		self.assertFalse(bureau_etudes.in_view("mine", {"mine": True, "status": "Réalisable"}))
		self.assertFalse(bureau_etudes.in_view("mine", {"mine": False, "status": "En étude"}))

	def test_champs_d_une_condition(self):
		self.assertEqual(bureau_etudes.condition_fields("doc.trace and doc.imposition and doc.taux_chutes"), ["trace", "imposition", "taux_chutes"])
		self.assertEqual(bureau_etudes.condition_fields(""), [])

	def test_sans_droit_pas_de_liste(self):
		with patch.object(bureau_etudes, "readable_doctypes", return_value=[]), self.assertRaises(frappe.PermissionError):
			bureau_etudes.get_etudes()


class TestAccueilEtude(FrappeTestCase):
	def _transition(self, state, action, allowed, condition=None):
		return frappe._dict(state=state, action=action, allowed=allowed, condition=condition)

	def test_conclure_exige_la_condition_du_workflow(self):
		transitions = [self._transition("En étude", "Réalisable", "R", "doc.trace and doc.imposition and doc.taux_chutes > 0")]
		self.assertEqual(bureau_etudes_accueil.required_fields(bureau_etudes.OFFSET, transitions), ["trace", "imposition", "taux_chutes"])

	def test_sans_condition_toutes_les_pieces_comptent(self):
		self.assertEqual(bureau_etudes_accueil.required_fields(bureau_etudes.FLEXO, []), ["trace", "cliche"])

	def test_groupes_de_la_file(self):
		group = bureau_etudes_accueil.queue_group
		self.assertEqual(group("Nouveau", "U3", ["trace"]), "urgent")
		self.assertEqual(group("Nouveau", "U0", ["trace"]), "start")
		self.assertEqual(group("En étude", "U1", ["trace"]), "missing")
		self.assertEqual(group("En étude", "U1", []), "ready")

	def test_action_selon_le_role(self):
		action = bureau_etudes_accueil.row_action
		responsable = {("En étude", "Réalisable")}
		self.assertEqual(action("Nouveau", [], {("Nouveau", "Démarrer")}, True)["kind"], "run")
		self.assertEqual(action("Nouveau", [], set(), True)["kind"], "open")
		self.assertEqual(action("En étude", [], responsable, True)["label"], "Conclure")
		self.assertEqual(action("En étude", [], set(), True)["label"], "Ouvrir")
		self.assertEqual(action("En étude", ["trace"], responsable, True)["label"], "Compléter")
		self.assertEqual(action("En étude", ["trace"], set(), False)["label"], "Ouvrir")

	def test_accueil_limite_aux_documents_lisibles(self):
		with patch.object(bureau_etudes, "readable_doctypes", return_value=[bureau_etudes.FLEXO]), patch.object(bureau_etudes_accueil, "readable_doctypes", return_value=[bureau_etudes.FLEXO]):
			response = bureau_etudes_accueil.get_etude_accueil()
		self.assertEqual([stage["key"] for stage in response["stages"]], ["etudes_flexo"])
		self.assertEqual({row["doctype"] for group in response["queue"] for row in group["rows"]} - {bureau_etudes.FLEXO}, set())
		self.assertFalse(response["both"])


class TestPiecesEtude(FrappeTestCase):
	"""Règles des pièces sans document : contrôles de la presse, format de la feuille, origine des cotations."""

	def _machine(self, **values):
		return frappe._dict({"status": "Operationnelle", "format_max_laize": 1020, "format_max_developpement": 720, "min_qt": 5000, **values})

	def test_format_de_la_feuille(self):
		self.assertEqual(bureau_etudes_pieces.sheet_size({"format_laize": 1020, "format_developpement": 600}), (1020, 600))
		self.assertEqual(bureau_etudes_pieces.sheet_size({"format_imp": "650 x 500"}), (650, 500))
		self.assertEqual(bureau_etudes_pieces.sheet_size({"format_imp": "720,5x450"}), (720.5, 450))
		self.assertEqual(bureau_etudes_pieces.sheet_size({"format_imp": "voir fichier"}), (0, 0))

	def test_presse_sans_alerte(self):
		self.assertEqual(bureau_etudes_pieces.machine_alerts(self._machine(), {"format_imp": "1020x600"}, 83334), [])

	def test_format_trop_grand_en_rouge(self):
		alerts = bureau_etudes_pieces.machine_alerts(self._machine(format_max_laize=800), {"format_imp": "1020x800"}, 83334)
		self.assertEqual([alert["tone"] for alert in alerts], ["red", "red"])
		self.assertIn("1020 mm", alerts[0]["text"])

	def test_presse_arretee_et_petite_quantite_a_verifier(self):
		alerts = bureau_etudes_pieces.machine_alerts(self._machine(status="En Maintenance"), {"format_imp": "1020x600"}, 1000)
		self.assertEqual([alert["tone"] for alert in alerts], ["amber", "amber"])

	def test_sans_imposition_seul_l_etat_de_la_presse_compte(self):
		self.assertEqual(bureau_etudes_pieces.machine_alerts(self._machine(), None, 0), [])
		self.assertEqual(len(bureau_etudes_pieces.machine_alerts(self._machine(status="En Panne"), None, 0)), 1)

	def test_dessin_absent_d_une_imposition_manuelle(self):
		self.assertIsNone(bureau_etudes_pieces.sheet_drawing({"n_col": 0, "n_rang": 0, "calcul_imposition": None}))

	def test_valeurs_d_imposition_controlees(self):
		values = bureau_etudes_pieces._imposition_values("Laize", "1020", "1020 x 600", 12, "22,8")
		self.assertEqual((values["format_imp"], values["format_laize"], values["format_developpement"], values["taux_chutes"]), ("1020x600", 1020, 600, 22.8))
		for bad in (("Laize", "720x450", "1020x600", 12, 0), ("Palette", "720", "1020x600", 12, 0), ("Laize", "720", "1020", 12, 0), ("Laize", "720", "1020x600", 0, 0), ("Laize", "720", "1020x600", 12, 120), ("", "720", "1020x600", 12, 0)):
			with self.assertRaises(frappe.ValidationError):
				bureau_etudes_pieces._imposition_values(*bad)

	def test_observations_en_texte_simple(self):
		self.assertEqual(bureau_etudes.plain_text("<p>Pli à l'envers</p><p>Voir &amp; revoir</p>"), "Pli à l'envers\nVoir & revoir")
		self.assertEqual(bureau_etudes.plain_text("un<br>deux"), "un\ndeux")
		self.assertEqual(bureau_etudes.plain_text(None), "")


class TestOrigineCotations(FrappeTestCase):
	"""Cotations venues d'un BAT, puis remplacées depuis le tracé : la confirmation et ce qui en reste. Annulé en fin de test."""

	def setUp(self):
		if not frappe.get_meta("Item").has_field("custom_cotations_bat"):
			self.skipTest("Champs d'origine pas encore migrés.")
		self.item = frappe.db.get_value("Item", {"custom_type_article": "Client"}, "name")
		self.assertTrue(self.item)
		frappe.db.set_value("Item", self.item, {"custom_cotations_article": "72x46.5x107", "custom_cotations_bat": None, "custom_cotations_trace_par": None})

	def tearDown(self):
		frappe.db.rollback()

	def _doc(self):
		return frappe.get_doc("Item", self.item)

	def _import_bat(self):
		doc = self._doc()
		item_cotations.record_bat_cotations(doc, "72x46,5x107")
		frappe.db.set_value("Item", self.item, {"custom_cotations_bat": doc.custom_cotations_bat, "custom_cotations_bat_par": doc.custom_cotations_bat_par, "custom_cotations_bat_le": doc.custom_cotations_bat_le})

	def test_sans_bat_aucune_confirmation(self):
		self.assertIsNone(item_cotations.bat_confirmation(self.item, "80x40x100"))
		self.assertIsNone(item_cotations.cotations_origin(self._doc()))

	def test_valeur_du_bat_normalisee_et_etat_bat(self):
		self._import_bat()
		origin = item_cotations.cotations_origin(self._doc())
		self.assertEqual((origin["bat"], origin["etat"]), ("72x46.5x107", "bat"))

	def test_memes_dimensions_rien_a_confirmer(self):
		self._import_bat()
		self.assertIsNone(item_cotations.bat_confirmation(self.item, "72 × 46,5 × 107"))

	def test_autres_dimensions_a_confirmer(self):
		self._import_bat()
		confirmation = item_cotations.bat_confirmation(self.item, "80x40x100")
		self.assertEqual((confirmation["actuelles"], confirmation["nouvelles"]), ("72x46.5x107", "80x40x100"))

	def test_remplacement_garde_qui_et_le_fil(self):
		self._import_bat()
		frappe.db.delete("Trace", {"article": self.item})
		item_cotations.apply_cotations_from_user_string(self.item, "80x40x100", ignore_permissions=True)
		doc = self._doc()
		self.assertEqual(doc.custom_cotations_article, "80x40x100")
		self.assertEqual(doc.custom_cotations_trace_par, frappe.session.user)
		self.assertTrue(frappe.db.exists("Comment", {"reference_doctype": "Item", "reference_name": self.item, "comment_type": "Info", "content": ["like", "%72x46.5x107%80x40x100%"]}))
		# Sans tracé qui porte ces cotations, le changement ne peut pas lui être attribué.
		self.assertEqual(item_cotations.cotations_origin(doc)["etat"], "fiche")
		# Une fois remplacées, les suivantes ne viennent plus du BAT : plus de confirmation.
		self.assertIsNone(item_cotations.bat_confirmation(self.item, "90x40x100"))

	def test_nouvel_import_efface_le_remplacement(self):
		self._import_bat()
		item_cotations.apply_cotations_from_user_string(self.item, "80x40x100", ignore_permissions=True)
		doc = self._doc()
		item_cotations.record_bat_cotations(doc, "80x40x100")
		self.assertIsNone(doc.custom_cotations_trace_par)
		self.assertEqual(doc.custom_cotations_bat, "80x40x100")


class TestAtelierBureau(FrappeTestCase):
	"""Règles de l'atelier du bureau. Annulé en fin de test : aucun calcul n'est lancé."""

	def tearDown(self):
		frappe.db.rollback()

	def test_formats_sans_calcul_tous_coches(self):
		rows = bureau_atelier.merge_formats([{"laize": 1020, "depl": 700, "libelle": "A"}], [])
		self.assertEqual([(row["libelle"], row["coche"]) for row in rows], [("A", True)])

	def test_formats_coches_selon_le_calcul_et_format_manuel_garde(self):
		proposes = [{"laize": 1020, "depl": 700, "libelle": "A"}, {"laize": 780, "depl": 700, "libelle": "B"}]
		etudies = [{"laize": 1020.5, "depl": 700, "libelle": "A"}, {"laize": 500, "depl": 400, "origine": "Manuel", "libelle": "C"}]
		rows = bureau_atelier.merge_formats(proposes, etudies)
		self.assertEqual([(row["libelle"], row["coche"]) for row in rows], [("A", True), ("B", False), ("C", True)])

	def test_feuille_et_bobine_ne_se_confondent_pas(self):
		rows = bureau_atelier.merge_formats([{"laize": 1020, "depl": 800, "bobine": 1, "libelle": "B"}], [{"laize": 1020, "depl": 800, "bobine": 0, "libelle": "F"}])
		self.assertEqual(len(rows), 2)

	def test_bobine_a_la_main_exige_un_maximum(self):
		row = {"laize": 800, "origine": "Manuel", "bobine": 1, "depl": 0}
		with self.assertRaises(frappe.ValidationError):
			bureau_atelier.check_manual_rolls([row])
		bureau_atelier.check_manual_rolls([{**row, "depl": 1020}, {**row, "origine": "Stock"}])

	def test_test_rapide_exige_un_pdf(self):
		with self.assertRaises(frappe.ValidationError):
			bureau_atelier.calcul_arguments({"pont": 1})

	def test_test_rapide_sans_article(self):
		args, _values = bureau_atelier.calcul_arguments({"fichier_trace": "/private/files/x.pdf", "pont": 1, "quantite": 5000, "trait_commun": 1})
		self.assertIsNone(args["etude"])
		self.assertNotIn("article", args)
		self.assertEqual((args["quantite"], args["ignorer_contraintes_machine"]), (5000, 1))

	def _etude(self, status):
		name = frappe.db.get_value("Etude Faisabilite", {"status": status}, "name")
		if not name:
			self.skipTest(f"Aucune étude {status} sur ce site.")
		return name

	def test_etude_impose_sa_quantite_et_son_article(self):
		name = self._etude("En étude")
		doc = frappe.get_doc("Etude Faisabilite", name)
		if not doc.trace:
			self.skipTest("Étude sans tracé.")
		args, _values = bureau_atelier.calcul_arguments({"etude": name, "fichier_trace": "/private/files/x.pdf", "pont": 1, "quantite": 1, "trait_commun": 1})
		self.assertEqual((args["quantite"], args["article"], args["trace"]), (doc.quantite, doc.article, doc.trace))

	def test_etude_conclue_ne_se_calcule_pas(self):
		name = self._etude("Réalisable")
		with self.assertRaises(frappe.ValidationError):
			bureau_atelier.calcul_arguments({"etude": name, "fichier_trace": "/private/files/x.pdf", "pont": 1})

	def test_calcul_d_une_autre_etude_refuse(self):
		name = self._etude("En étude")
		calcul = frappe.db.get_value("Calcul Imposition", {"etude_faisabilite": ["not in", [name]]}, "name")
		if not calcul:
			self.skipTest("Aucun autre calcul.")
		with self.assertRaises(frappe.ValidationError):
			bureau_atelier.calcul_arguments({"etude": name, "calcul": calcul, "fichier_trace": "/private/files/x.pdf", "pont": 1})

	def test_creation_refusee_sur_etude_conclue(self):
		name = self._etude("Réalisable")
		with self.assertRaises(frappe.ValidationError):
			bureau_atelier.create_atelier_imposition(name, "x", 1)

	def test_lien_du_menu_selon_les_droits(self):
		self.assertIn("Calcul Imposition", bureau_postes.DOCTYPES_INTERFACE)
