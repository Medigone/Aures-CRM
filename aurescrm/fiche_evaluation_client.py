# aurescrm/fiche_evaluation_client.py
import frappe

def calculate_global_score(doc, method):
    # Répartition des points
    points = {
        "Très insatisfait": 1,
        "Insatisfait": 2,
        "Neutre": 3,
        "Satisfait": 4,
        "Très satisfait": 5
    }

    total_score = 0

    # Liste des champs de sélection dans le Doctype
    questions_fields = ['q11', 'q12', 'q21', 'q22', 'q31', 'q32', 'q41', 'q42', 'q51', 'q52']

    for field in questions_fields:
        # Récupérer la réponse à la question
        response = getattr(doc, field, None)
        if response and response in points:
            total_score += points[response]

    # Mettre à jour le champ 'note_globale' avec la somme des notes
    doc.note_globale = total_score

    # Déterminer le statut en fonction de la note_globale
    if total_score >= 10 and total_score <= 25:
        doc.status = "Action"  # Rouge
    elif total_score >= 26 and total_score <= 35:
        doc.status = "Amélioration"  # Orange
    elif total_score >= 36 and total_score <= 50:
        doc.status = "Inaction"  # Vert
    
    # Sauvegarder le document après la mise à jour
    doc.save(ignore_permissions=True)
