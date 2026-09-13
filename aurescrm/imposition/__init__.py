# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Moteur d'imposition v1 — Aures Emballages.

Entrée  : PDF de tracé Esko (noir = coupe, rouge = rainage, bleu = cotation).
Sortie  : scénarios d'imposition chiffrés + PDF d'imposition à l'échelle 1:1.

L'outil propose, l'ingénieur décide : aucun scénario n'est appliqué sans
validation humaine explicite (cf. `api.creer_imposition`).
"""
