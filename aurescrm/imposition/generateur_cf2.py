# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt

"""Export CFF2 (carton) pour import ArtiosCAD — couches CUT / CREASE, mm, 1:1.

Sans import frappe. La géométrie est la même grille que le PDF d'imposition.
À valider sur un poste ArtiosCAD (File → Import).
"""

from aurescrm.imposition.generateur_pdf import segments_imposes


def nom_fichier_cff2(disposition, index=None):
	base = f"{disposition.laize:.0f}x{disposition.depl:.0f}_{disposition.n_col}x{disposition.n_rang}"
	if index is not None:
		base = f"{base}_{index}"
	return f"{base}.cf2"


def ecrire_cff2(chemin, coupe, rainage):
	"""Écrit un CFF2 v2 (unités mm, couches CUT=1 et CREASE=2)."""
	lignes = [
		"$BOF",
		"V2",
		"UA MM",
		"$UNITS",
		"MM",
		"$SCALE",
		"1,1",
		"$LYR",
		"1,CUT,CUT,1",
		"2,CREASE,CREASE,2",
		"$END",
	]
	for (ax, ay), (bx, by) in coupe:
		lignes.append(f"L,1,{ax:.3f},{ay:.3f},{bx:.3f},{by:.3f}")
	for (ax, ay), (bx, by) in rainage:
		lignes.append(f"L,2,{ax:.3f},{ay:.3f},{bx:.3f},{by:.3f}")
	lignes.append("$EOF")
	with open(chemin, "w", encoding="ascii", newline="\n") as f:
		f.write("\n".join(lignes) + "\n")
	return chemin


def generer_cff2(chemin, segments_coupe, segments_rainage, poly, disposition, parametres):
	coupe, rain = segments_imposes(
		segments_coupe, segments_rainage, poly, disposition, parametres
	)
	return ecrire_cff2(chemin, coupe, rain)
