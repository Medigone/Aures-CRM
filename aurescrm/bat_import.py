# Copyright (c) 2026, Medigo and contributors
# For license information, please see license.txt
"""Lecture d'un BAT PDF d'Aures Emballages : ce qui est écrit dans son cartouche, sa légende et les encres du fichier.

Rien n'est enregistré ici, et le fichier ne quitte pas le serveur. Le résultat n'est qu'une proposition : l'utilisateur
la vérifie avant toute écriture. Ce qui est vectorisé dans le PDF (souvent le client ou le Braille) n'est pas lisible.
"""

import re
import unicodedata

import fitz
import frappe
from frappe import _

from aurescrm.item_cotations import normalize_cotations_article
from aurescrm.pantone import CMJN, PANTONE, cmjn_code, describe, normalize_code

MAX_PAGES = 10
# Intitulés du cartouche, comparés sans accents ni casse, et sur toute la ligne : un mot du visuel ne les imite pas.
LABELS = {
	"nom du client": "client",
	"nom du projet": "projet",
	"ref. doc": "reference",
	"dimension": "dimension",
	"support": "support",
	"finitions": "finitions",
	"date": "date",
	"auteur": "auteur",
	"ver. bat": "version",
}
INFORMATION_LABELS = (("projet", "Nom du projet"), ("client", "Nom du client"), ("date", "Date du BAT"), ("auteur", "Auteur du BAT"), ("version", "Version du BAT"))
_LEGEND_PANTONE = re.compile(r"PANTONE\s*®?\s+([A-Za-z0-9 ]+?\s[CUcu])(?![A-Za-z0-9])")
_LEGEND_PROCESS = {"NOIR": "n", "BLACK": "n", "CYAN": "c", "MAGENTA": "m", "JAUNE": "j", "YELLOW": "j"}
# Ces encres servent au façonnage ou à l'interface : elles ne s'impriment pas comme une couleur de l'article.
_TECHNICAL_INK = re.compile(r"^(cut|coupe|decoupe|dieline|die line|rainage|(artios )?crease|braille|none|all|registration)$")
_PROCESS_INK = {"black", "noir", "cyan", "magenta", "yellow", "jaune"}
_LIGATURES = str.maketrans({"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl"})
# Cartouche aux intitulés vectorisés : seule la disposition des valeurs permet de les reconnaître.
_DIMENSION = re.compile(r"^\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?){1,2}\s*(?:mm)?$", re.I)
_GRAMMAGE = re.compile(r"\d\s*g\s*/\s*m", re.I)
_DATE = re.compile(r"^\d{1,2}\s*/\s*\d{1,2}\s*/\s*\d{2,4}$")
COLUMN_TOLERANCE = 4
PAGE_LABELS = {"reference": "Réf. doc", "dimension": "Dimension", "support": "Support", "finitions": "Finitions", "client": "Nom du client", "projet": "Nom du projet", "date": "Date du BAT", "auteur": "Auteur du BAT", "version": "Version du BAT"}


def _plain(text):
	text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
	return re.sub(r"\s+", " ", text).strip().lower()


def _label_key(text):
	return LABELS.get(_plain(text).rstrip(" :").strip())


def _text_lines(page):
	lines = []
	for block in page.get_text("dict").get("blocks", []):
		for line in block.get("lines", []):
			text = "".join(span["text"] for span in line["spans"]).translate(_LIGATURES).strip()
			if text:
				x0, y0, x1, y1 = line["bbox"]
				lines.append({"text": text, "x0": x0, "y0": y0, "x1": x1, "y1": y1})
	return lines


def _same_row(line, label):
	overlap = min(line["y1"], label["y1"]) - max(line["y0"], label["y0"])
	return overlap >= 0.4 * min(line["y1"] - line["y0"], label["y1"] - label["y0"])


def read_cartouche(lines):
	"""Chaque intitulé prend le texte à sa droite, sur la même ligne, jusqu'à l'intitulé suivant.
	Une valeur sur deux lignes se poursuit juste en dessous."""
	labels = []
	seen = set()
	for line in sorted(lines, key=lambda item: (item["y0"], item["x0"])):
		key = _label_key(line["text"])
		if key and key not in seen:
			seen.add(key)
			labels.append({**line, "key": key})
	values = {}
	taken = {id(line) for line in lines if _label_key(line["text"])}
	for label in labels:
		stops = [other["x0"] for other in labels if other is not label and other["x0"] > label["x1"] and _same_row(other, label)]
		stop = min(stops, default=float("inf"))
		found = [line for line in lines if id(line) not in taken and line["x0"] >= label["x1"] - 1 and line["x0"] < stop and _same_row(line, label)]
		if not found:
			continue
		found.sort(key=lambda item: item["x0"])
		taken.update(id(line) for line in found)
		last = found[-1]
		following = [line for line in lines if id(line) not in taken and -4 <= line["y0"] - last["y1"] <= 3 and line["x0"] < last["x1"] and line["x1"] > last["x0"] and line["x0"] < stop]
		for line in following:
			taken.add(id(line))
		if label["key"] == "reference" and len(found) > 1:
			# Un repère de langue suit parfois la référence dans sa case : `AB123 - X   vFr`.
			values["repere"] = " ".join(line["text"] for line in found[1:])
			found = found[:1]
		values[label["key"]] = re.sub(r"\s+", " ", " ".join(line["text"] for line in [*found, *following])).strip()
	if values.get("date"):
		values["date"] = re.sub(r"\s*/\s*", "/", values["date"])
	return values


def read_layout(lines):
	"""Intitulés vectorisés : les cotes et, juste dessous dans la même colonne, le support ancrent tout le cartouche.
	Sans cet ancrage, rien n'est lu : un texte du visuel ne doit pas passer pour une valeur."""
	ordered = sorted(lines, key=lambda item: (item["y0"], item["x0"]))
	for dimension in ordered:
		if not _DIMENSION.match(dimension["text"]):
			continue
		column = [line for line in ordered if line is not dimension and abs(line["x0"] - dimension["x0"]) <= COLUMN_TOLERANCE]
		reach = 3 * (dimension["y1"] - dimension["y0"])
		support = next((line for line in column if 0 < line["y0"] - dimension["y0"] <= reach and _GRAMMAGE.search(line["text"])), None)
		if support:
			return _layout_values(ordered, dimension, support, column)
	return {}


def _layout_values(lines, dimension, support, column):
	gap = support["y0"] - dimension["y0"]
	reference = next((line for line in reversed(column) if 0 < dimension["y0"] - line["y0"] <= 1.5 * gap), None)
	finitions = next((line for line in column if 0 < line["y0"] - support["y0"] <= 1.5 * gap), None)
	top = (reference or dimension)["y0"] - COLUMN_TOLERANCE
	bottom = (finitions or support)["y1"] + COLUMN_TOLERANCE
	row = [line for line in lines if top <= line["y0"] <= bottom and line not in (reference, dimension, support, finitions)]
	values = {"dimension": dimension["text"], "support": support["text"]}
	if reference:
		values["reference"] = reference["text"]
	if finitions:
		values["finitions"] = finitions["text"]
	date = next((line for line in row if line["x0"] > dimension["x0"] and _DATE.match(line["text"])), None)
	if date:
		values["date"] = re.sub(r"\s*/\s*", "/", date["text"])
		under = [line for line in row if line["y0"] > date["y0"] and abs(line["x0"] - date["x0"]) <= COLUMN_TOLERANCE]
		for key, line in zip(("auteur", "version"), under):
			values[key] = line["text"]
	left = [line for line in row if line["x1"] <= dimension["x0"] and line["y0"] < support["y0"]]
	client = next((line for line in left if reference and _same_row(line, reference)), None)
	if client:
		values["client"] = client["text"]
	projet = [line["text"] for line in left if line is not client]
	if projet:
		values["projet"] = " ".join(projet)
	if reference:
		limit = date["x0"] - COLUMN_TOLERANCE if date else float("inf")
		repere = [line["text"] for line in row if line["x0"] > reference["x1"] and line["x0"] < limit and _same_row(line, reference)]
		if repere:
			values["repere"] = " ".join(repere)
	return values


def merge_pages(pages):
	"""Une valeur commune aux pages est retenue. Si elles se contredisent, rien n'est tranché : les deux restent affichées."""
	cartouche, disagreements, marks = {}, {}, []
	for number, page in enumerate(pages, 1):
		if page.get("repere"):
			marks.append({"page": number, "value": page["repere"]})
		for key, value in page.items():
			if key == "repere":
				continue
			known = disagreements.get(key) or ([cartouche[key]] if key in cartouche else [])
			if not known:
				cartouche[key] = value
			elif _plain(value) not in {_plain(item) for item in known}:
				cartouche.pop(key, None)
				disagreements[key] = [*known, value]
	return {"cartouche": cartouche, "disagreements": disagreements, "marks": marks}


def read_legend(text):
	"""Couleurs annoncées par la légende, dans leur ordre, et encres de quadrichromie citées."""
	flat = re.sub(r"\s+", " ", text)
	pantones = []
	for match in _LEGEND_PANTONE.finditer(flat):
		code = normalize_code(match[1])
		if code not in pantones:
			pantones.append(code)
	process = {_LEGEND_PROCESS[word] for word in (line.strip().upper() for line in text.splitlines()) if word in _LEGEND_PROCESS}
	return pantones, process


def _ink_name(name):
	"""Les octets d'un nom d'encre sont en UTF-8 ou en Latin-1 selon le logiciel qui a produit le PDF."""
	try:
		return name.encode("latin-1").decode("utf-8")
	except UnicodeError:
		return name


def read_inks(document):
	"""Noms des encres déclarées dans le fichier : Separation et DeviceN."""
	names = []
	for xref in range(1, document.xref_length()):
		try:
			source = document.xref_object(xref, compressed=True)
		except Exception:
			continue
		found = re.findall(r"/Separation\s*/([^\s/\[\]<>()]+)", source)
		for group in re.findall(r"/DeviceN\s*\[([^\]]*)\]", source):
			found += re.findall(r"/([^\s/\[\]<>()]+)", group)
		for raw in found:
			name = _ink_name(re.sub(r"#([0-9A-Fa-f]{2})", lambda hit: chr(int(hit[1], 16)), raw))
			if name not in names:
				names.append(name)
	return names


def _noir_line(channel="n"):
	values = {key: 100 if key == channel else 0 for key in "cmjn"}
	names = {"c": "Cyan", "m": "Magenta", "j": "Jaune", "n": "Noir"}
	return {"type_couleur": CMJN, "code": cmjn_code(values["c"], values["m"], values["j"], values["n"]), "nom": names[channel], **values}


def compare_colors(legend, process, inks):
	"""Légende et encres d'accord : ligne retenue. Un Pantone d'un seul côté : à choisir, rien n'est tranché ici."""
	spots = []
	others = []
	for ink in inks:
		plain = _plain(ink).replace("_", " ")
		if plain.startswith("pantone") or plain.startswith("pms "):
			code = normalize_code(ink)
			if code not in spots:
				spots.append(code)
		elif plain not in _PROCESS_INK and not _TECHNICAL_INK.match(plain):
			others.append(ink)
	if legend and spots:
		kept = [code for code in legend if code in spots]
		gaps = [{"code": code, "source": "legende"} for code in legend if code not in spots] + [{"code": code, "source": "fichier"} for code in spots if code not in legend]
	else:
		kept, gaps = legend or spots, []
	# La quadri est annoncée par sa légende. Sans légende, le noir vient de l'encre du fichier.
	has_legend = bool(legend or process)
	channels = process if has_legend else ({"n"} if any(_plain(ink) in ("black", "noir") for ink in inks) else set())
	if channels & {"c", "m", "j"}:
		channels = {"c", "m", "j", "n"}
	return {"pantones": kept, "process": [channel for channel in "cmjn" if channel in channels], "gaps": gaps, "other_inks": others}


def read_document(data):
	"""Tout ce que le PDF permet de lire, sans base de données."""
	with fitz.open(stream=data, filetype="pdf") as document:
		if document.needs_pass:
			raise ValueError("protected")
		pages, text = [], []
		for index in range(min(document.page_count, MAX_PAGES)):
			page = document[index]
			lines = _text_lines(page)
			pages.append(read_cartouche(lines) or read_layout(lines))
			text.append(page.get_text())
		text = "\n".join(text)
		inks = read_inks(document)
		page_count = document.page_count
	legend, process = read_legend(text)
	return {
		**merge_pages(pages),
		"page_count": page_count,
		"recto_verso": page_count == 2 and all(pages),
		"colors": compare_colors(legend, process, inks),
		"braille": any(_plain(ink) == "braille" for ink in inks),
	}


def parse_support(raw, papers):
	"""`BBTB GC1 300g/m² ± 5%` : le papier le plus long reconnu au début, le grammage, la tolérance, et ce qui reste."""
	rest = raw or ""
	grammage = tolerance = None
	match = re.search(r"(\d+(?:[.,]\d+)?)\s*g\s*/?\s*m\s*[²2]?", rest, re.I)
	if match:
		grammage = match[1].replace(",", ".")
		rest = rest[: match.start()] + " " + rest[match.end() :]
	match = re.search(r"(?:±|\+/-)\s*(\d+(?:[.,]\d+)?\s*%)", rest)
	if match:
		tolerance = re.sub(r"\s+", "", match[1])
		rest = rest[: match.start()] + " " + rest[match.end() :]
	rest = re.sub(r"\s+", " ", rest).strip()
	paper = None
	for name in sorted(papers, key=len, reverse=True):
		if re.match(rf"{re.escape(_plain(name))}(?![a-z0-9])", _plain(rest)):
			paper = name
			rest = rest[len(name) :].strip()
			break
	return {"papier": paper, "grammage": grammage, "tolerance": tolerance, "reste": rest}


def match_finishes(raw, fields):
	"""Cases et choix de la fiche que citent les finitions. Ce qui ne correspond à rien revient dans `unknown`."""
	found, unknown = [], []
	checks = [field for field in fields if field["fieldtype"] == "Check"]
	pelliculage = next((field for field in fields if field["fieldname"] == "custom_pelliculage"), None)
	for part in re.split(r"[,;+/]| et ", raw or ""):
		part = part.strip()
		plain = _plain(part)
		if not plain or plain == "sans":
			continue
		hit = None
		if "pellicul" in plain and pelliculage:
			option = next((option for option in pelliculage.get("options") or [] if _plain(option) != "sans" and re.search(rf"\b{re.escape(_plain(option))}\b", plain)), None)
			if option:
				hit = (pelliculage, option)
		if not hit:
			check = next((field for field in sorted(checks, key=lambda item: -len(item["label"])) if re.search(rf"\b{re.escape(_plain(field['label']))}\b", plain)), None)
			if check:
				hit = (check, "1")
		if hit:
			found.append({"field": hit[0], "value": hit[1], "raw": part})
		else:
			unknown.append(part)
	return found, unknown


def _field_proposal(field, value, raw, source):
	return {"key": field["fieldname"], "fieldname": field["fieldname"], "label": field["label"], "fieldtype": field["fieldtype"], "value": value, "raw": raw, "source": source}


def build_proposals(document, schema, papers, grammages):
	"""Traduit la lecture en propositions de champs. Une valeur hors des listes du Desk reste affichée, sans être proposée."""
	cartouche = document["cartouche"]
	fields = {field["fieldname"]: field for group in schema["groups"] for field in group["fields"]}
	proposals, informations = [], []

	def add(fieldname, value, raw, source):
		if fieldname in fields and value not in (None, ""):
			proposals.append(_field_proposal(fields[fieldname], value, raw, source))
			return True
		return False

	def inform(label, value):
		if value:
			informations.append({"label": label, "value": value})

	if cartouche.get("reference"):
		proposals.append({"key": "reference", "fieldname": None, "label": "Réf. article client", "fieldtype": "Data", "value": cartouche["reference"], "raw": cartouche["reference"], "source": "Réf. doc"})
	dimension = cartouche.get("dimension")
	if dimension and not add("custom_cotations_article", normalize_cotations_article(dimension), dimension, "Dimension"):
		inform("Dimension", dimension)
	raw_support = cartouche.get("support")
	if raw_support:
		support = parse_support(raw_support, papers)
		add("custom_support", support["papier"], raw_support, "Support")
		add("custom_grammage", support["grammage"] if support["grammage"] in grammages else None, raw_support, "Support")
		add("custom_tolérance_", support["tolerance"], raw_support, "Support")
		if not support["papier"] or (support["grammage"] and support["grammage"] not in grammages):
			inform("Support lu", raw_support)
		elif support["reste"]:
			inform("Support, précision", support["reste"])
	found, unknown = match_finishes(cartouche.get("finitions"), list(fields.values()))
	for item in found:
		add(item["field"]["fieldname"], item["value"], item["raw"], "Finitions")
	inform("Finition non reconnue", ", ".join(unknown))
	if document["braille"]:
		add("custom_braille", "1", "Encre Braille", "Encres du fichier")
	if document["recto_verso"]:
		add("custom_recto_verso", "1", "2 pages", "Nombre de pages")
	elif document["page_count"] > 1:
		inform("Pages du BAT", f"{document['page_count']} pages")
	colors = document["colors"]
	inform("Autres encres du fichier", ", ".join(colors["other_inks"]))
	for key, label in INFORMATION_LABELS:
		inform(label, cartouche.get(key))
	for key, values in document["disagreements"].items():
		inform(f"{PAGE_LABELS[key]} selon les pages", " / ".join(values))
	for mark in document["marks"]:
		inform(f"Repère de la page {mark['page']}" if document["page_count"] > 1 else "Repère", mark["value"])

	codes = [*colors["pantones"], *(gap["code"] for gap in colors["gaps"])]
	details = describe(codes)
	blank = {"nom": "", "c": 0, "m": 0, "j": 0, "n": 0}
	teintes = [{"type_couleur": PANTONE, **blank, **details[code]} for code in colors["pantones"]] + [_noir_line(channel) for channel in colors["process"]]
	gaps = [{"type_couleur": PANTONE, **blank, **details[gap["code"]], "source": gap["source"]} for gap in colors["gaps"]]
	return {"propositions": proposals, "informations": informations, "teintes": teintes, "ecarts": gaps}


def analyze(data, schema, papers, grammages):
	if b"%PDF-" not in data[:1024]:
		frappe.throw(_("Ce fichier n'est pas un PDF."))
	try:
		document = read_document(data)
	except ValueError:
		frappe.throw(_("Ce PDF est protégé par un mot de passe : il ne peut pas être lu."))
	except Exception:
		frappe.throw(_("Ce PDF est illisible ou endommagé."))
	return build_proposals(document, schema, papers, grammages)
