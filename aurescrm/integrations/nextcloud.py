"""
Intégration WebDAV / Nextcloud pour la GED client (Aures).

Les identifiants sont lus via ``frappe.get_site_config()`` (clés ``nextcloud_*``).
"""

from __future__ import annotations

import json
import re
import secrets
import string
import unicodedata
import urllib.parse
from datetime import timedelta
from typing import Any

import frappe
import requests
from frappe import _
from frappe.utils import cint, get_url, getdate, nowdate
from requests.auth import HTTPBasicAuth

_REQUEST_TIMEOUT = 15

# Translittérations usuelles non couvertes par NFD (ligatures, etc.)
_EXTRA_ASCII = str.maketrans(
    {
        "œ": "oe",
        "Œ": "Oe",
        "æ": "ae",
        "Æ": "Ae",
    }
)


def _get_config() -> dict[str, str]:
    """Retourne la config Nextcloud du site. Lève ``frappe.ValidationError`` si une clé manque."""
    cfg = frappe.get_site_config() or {}
    required = {
        "nextcloud_url",
        "nextcloud_user",
        "nextcloud_password",
        "nextcloud_base_folder",
    }
    missing = sorted(required - set(cfg.keys()))
    if missing:
        frappe.throw(
            frappe._(
                "Configuration Nextcloud incomplète : mots-clés manquants {0}."
                " Configurez-les via bench set-config (nextcloud_url, nextcloud_user,"
                " nextcloud_password, nextcloud_base_folder)."
            ).format(", ".join(missing))
        )
    out = {k: (cfg.get(k) or "") for k in required}
    empty = [k for k, v in out.items() if not str(v).strip()]
    if empty:
        frappe.throw(
            frappe._(
                "Configuration Nextcloud incomplète : valeurs vides pour {0}."
            ).format(", ".join(sorted(empty)))
        )
    return {
        "nextcloud_url": out["nextcloud_url"].rstrip("/"),
        "nextcloud_user": out["nextcloud_user"].strip(),
        "nextcloud_password": out["nextcloud_password"],
        "nextcloud_base_folder": out["nextcloud_base_folder"].strip().strip("/"),
    }


def sanitize_customer_name(name: str) -> str:
    """
    Applique les règles de nommage du segment client (ASCII, tirets, longueur max 80).
    """
    if name is None:
        return ""
    text = str(name).strip()
    if not text:
        return ""
    text = text.translate(_EXTRA_ASCII)
    # Translit. accents (ex. é -> e) via NFD
    text = "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )
    buf: list[str] = []
    for ch in text:
        if (ch.isascii() and ch.isalnum()) or ch in ("_",):
            buf.append(ch)
        elif ch in ("-",):
            buf.append("-")
        else:
            buf.append("-")
    s = "".join(buf)
    s = re.sub(r"-+", "-", s)
    s = s.strip("-_")
    if len(s) > 80:
        s = s[:80].rstrip("-_")
    return s


def build_folder_name(customer_doc: Any) -> str:
    """
    ``{name}-{sanitized_customer_name}`` ou ``{name}`` si la partie sanit. est vide.
    ``customer_doc`` : document Customer ou ``dict`` avec clés ``name`` et ``customer_name``.
    """
    if isinstance(customer_doc, str):
        frappe.throw(
            frappe._("build_folder_name : un document Client (Customer) est requis, pas une chaîne.")
        )
    if isinstance(customer_doc, dict):
        name = customer_doc.get("name") or ""
        cn = customer_doc.get("customer_name") or ""
    else:
        name = customer_doc.name
        cn = getattr(customer_doc, "customer_name", None) or ""
    seg = sanitize_customer_name(cn or "")
    if not seg:
        return str(name)
    return f"{name}-{seg}"


def _webdav_url(path: str) -> str:
    """Construit l'URL WebDAV complète (fichier utilisateur), segments encodés."""
    cfg = _get_config()
    user = cfg["nextcloud_user"]
    rel = path.strip().strip("/")
    parts = [p for p in rel.split("/") if p]
    encoded = "/".join(urllib.parse.quote(p, safe="") for p in parts)
    quoted_user = urllib.parse.quote(user, safe="")
    return f"{cfg['nextcloud_url']}/remote.php/dav/files/{quoted_user}/{encoded}"


def _folder_path_url(base_folder: str, folder_name: str) -> str:
    """URL de secours (chemin) — utilisée seulement si le fileid n'est pas disponible."""
    cfg = _get_config()
    dir_path = f"/{base_folder}/{folder_name}"
    return f"{cfg['nextcloud_url']}/apps/files/?dir={urllib.parse.quote(dir_path, safe='/')}"


def _folder_id_url(fileid: str | int) -> str:
    """
    URL « persistante » Nextcloud : ``/<url>/f/<fileid>`` — reste valide après renommage
    ou déplacement du dossier côté Nextcloud.
    """
    cfg = _get_config()
    return f"{cfg['nextcloud_url']}/f/{fileid}"


_PROPFIND_FILEID_BODY = (
    '<?xml version="1.0"?>'
    '<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">'
    "<d:prop>"
    "<oc:fileid/>"
    "</d:prop>"
    "</d:propfind>"
)


def _propfind_fileid(path: str) -> str | None:
    """PROPFIND depth=0 pour récupérer le fileid (oc:fileid) d'un dossier existant."""
    cfg = _get_config()
    url = _webdav_url(path)
    auth = HTTPBasicAuth(cfg["nextcloud_user"], cfg["nextcloud_password"])
    headers = {"Depth": "0", "Content-Type": "application/xml"}
    try:
        resp = requests.request(
            "PROPFIND",
            url,
            data=_PROPFIND_FILEID_BODY,
            headers=headers,
            auth=auth,
            timeout=_REQUEST_TIMEOUT,
        )
    except requests.RequestException as e:
        frappe.log_error(
            message=f"PROPFIND exception: {e!s}",
            title="Nextcloud WebDAV",
        )
        return None
    if resp.status_code not in (200, 207):
        frappe.log_error(
            message=f"PROPFIND HTTP {resp.status_code}\n{resp.text[:2000]!s}",
            title="Nextcloud WebDAV",
        )
        return None
    m = re.search(
        r"<oc:fileid[^>]*>\s*(\d+)\s*</oc:fileid>",
        resp.text or "",
        flags=re.IGNORECASE,
    )
    return m.group(1) if m else None


def create_folder(folder_name: str) -> dict | None:
    """
    Crée le dossier ``{base}/folder_name`` via WebDAV (MKCOL) puis récupère son ``fileid`` pour
    construire une URL persistante (qui résiste aux renommages côté Nextcloud). Retourne
    ``{"created": bool, "url": ui_url, "fileid": str|None}`` ou ``None`` (hors 201/405).
    """
    if not folder_name or not str(folder_name).strip():
        frappe.log_error(
            message="create_folder: folder_name vide",
            title="Nextcloud",
        )
        return None
    cfg = _get_config()
    base = cfg["nextcloud_base_folder"]
    fname = str(folder_name).strip()
    path = f"{base}/{fname}"
    url = _webdav_url(path)
    auth = HTTPBasicAuth(cfg["nextcloud_user"], cfg["nextcloud_password"])
    try:
        resp = requests.request("MKCOL", url, auth=auth, timeout=_REQUEST_TIMEOUT)
    except requests.RequestException as e:
        frappe.log_error(
            message=f"MKCOL exception: {e!s}",
            title="Nextcloud WebDAV",
        )
        return None
    status = resp.status_code
    if status not in (201, 405):
        frappe.log_error(
            message=f"MKCOL HTTP {status}\n{resp.text[:2000]!s}",
            title="Nextcloud WebDAV",
        )
        return None
    created = status == 201
    fileid = resp.headers.get("OC-FileId") or resp.headers.get("Oc-Fileid")
    if not fileid:
        # Dossier déjà présent (405) ou en-tête non renvoyée : on interroge Nextcloud.
        fileid = _propfind_fileid(path)
    ui_url = _folder_id_url(fileid) if fileid else _folder_path_url(base, fname)
    return {
        "created": created,
        "url": ui_url,
        "fileid": fileid,
    }


def ensure_customer_folder(customer: str) -> str:
    """
    Assure l'existence du dossier client sur Nextcloud et enregistre ``nextcloud_folder_url``.

    L'URL enregistrée est basée sur le **fileid** Nextcloud (``/f/<id>``) quand disponible : elle
    suit donc le dossier même si un utilisateur le renomme ou le déplace côté Nextcloud. Si l'URL
    déjà stockée est au format persistant (``/f/``), on la retourne telle quelle.
    """
    if not customer:
        frappe.throw(frappe._("Client (Customer) manquant."))
    has_field = frappe.get_meta("Customer").has_field("nextcloud_folder_url")
    if has_field:
        existing = frappe.db.get_value("Customer", customer, "nextcloud_folder_url")
        if existing and "/f/" in existing:
            return existing

    if not frappe.db.exists("Customer", customer):
        frappe.throw(frappe._("Client {0} introuvable.").format(customer))

    doc = frappe.get_doc("Customer", customer)
    fname = build_folder_name(doc)
    result = create_folder(fname)
    if not result:
        frappe.throw(
            frappe._(
                "Impossible de créer le dossier Nextcloud pour ce client. "
                "Consultez les logs (Nextcloud WebDAV) ou la configuration."
            )
        )
    url = result["url"]
    if has_field:
        frappe.db.set_value("Customer", customer, "nextcloud_folder_url", url, update_modified=False)
    return url


EMAIL_TEMPLATE_NAME = "Lien upload maquette client"
_OCS_HEADERS = {"OCS-APIRequest": "true", "Content-Type": "application/x-www-form-urlencoded"}


def generate_secure_password(length: int = 12) -> str:
    """Mot de passe alphanumérique (min. 10 car. côté Nextcloud)."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _ocs_create_share_url() -> str:
    cfg = _get_config()
    return f"{cfg['nextcloud_url']}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json"


def _share_path_for_folder(base_folder: str, folder_name: str, subpath: str | None) -> str:
    p = f"/{base_folder.strip('/')}/{str(folder_name).strip().strip('/')}"
    if subpath and str(subpath).strip():
        rest = "/".join(x for x in str(subpath).replace("\\", "/").split("/") if x)
        if rest:
            p = f"{p}/{rest}"
    return p


def create_upload_link(
    folder_name: str,
    subpath: str | None = None,
    password: str | None = None,
    label: str | None = None,
    expire_days: int = 7,
) -> dict:
    """
    Crée un lien public « file drop » (upload) via l'API OCS de Nextcloud.

    Retourne ``url``, ``token``, ``id``, ``expiration``, ``password`` (mot de passe en clair transmis
    telle quelle, pour affichage unique côté client — ne pas logger ni persister).
    """
    cfg = _get_config()
    if expire_days < 1 or expire_days > 7:
        frappe.throw(_("La durée d'expiration du partage doit être entre 1 et 7 jours (politique Nextcloud)."))
    path = _share_path_for_folder(cfg["nextcloud_base_folder"], folder_name, subpath)
    expire_on = getdate(nowdate()) + timedelta(days=expire_days)
    expire_str = expire_on.strftime("%Y-%m-%d")
    auth = HTTPBasicAuth(cfg["nextcloud_user"], cfg["nextcloud_password"])
    # note = libellé affichable côté partage
    data = {
        "path": path,
        "shareType": "3",
        "permissions": "4",
        "expireDate": expire_str,
    }
    if password:
        data["password"] = password
    if label:
        data["note"] = (label or "")[:512]
    # Dépôt de fichiers (upload uniquement) — requis sur les instances avec « File drop »
    data["publicUpload"] = "1"
    try:
        resp = requests.post(
            _ocs_create_share_url(),
            data=data,
            headers=_OCS_HEADERS,
            auth=auth,
            timeout=_REQUEST_TIMEOUT,
        )
    except requests.RequestException as e:
        frappe.log_error(
            message=f"OCS partage: exception {e!s}",
            title="Nextcloud OCS",
        )
        frappe.throw(
            _(
                "Connexion à Nextcloud impossible. Vérifiez l'URL et le réseau, ou consultez les logs."
            )
        )
    try:
        payload = resp.json()
    except Exception:
        payload = None
    ocs = (payload or {}).get("ocs", {}) or {}
    meta = ocs.get("meta", {}) or {}
    ok = meta.get("status") == "ok" and (ocs.get("data") is not None)
    if not ok and resp.status_code in (200, 201) and ocs.get("data"):
        ok = True
    if not ok:
        err_msg = f"OCS HTTP {resp.status_code}"
        if payload:
            err_msg = f"{err_msg} — {json.dumps(ocs)[:2000]}"
        else:
            err_msg = f"{err_msg} — {resp.text[:2000]!s}"
        frappe.log_error(
            message=err_msg,
            title="Nextcloud OCS",
        )
        if resp.status_code in (400, 401, 403, 404):
            frappe.throw(
                _(
                    "Nextcloud a refusé la création du partage. Vérifiez le chemin, les droits de"
                    " l'utilisateur ERP-Bot et la configuration (réponse {0})."
                ).format(resp.status_code)
            )
        frappe.throw(
            _(
                "La création du lien de dépôt a échoué. Vérifiez les logs « Nextcloud OCS » pour le"
                f" détail (HTTP {resp.status_code})."
            )
        )
    sdata = ocs.get("data", {}) or {}
    share_url = sdata.get("url") or ""
    token = sdata.get("token") or ""
    if not share_url and token and cfg.get("nextcloud_url"):
        share_url = f"{cfg['nextcloud_url']}/s/{token}"
    return {
        "url": share_url,
        "token": token,
        "id": cint(sdata.get("id") or 0) or 0,
        "expiration": sdata.get("expiration") or expire_str,
        "password": password or "",
    }


def _get_email_template() -> Any:
    if not frappe.db.exists("Email Template", EMAIL_TEMPLATE_NAME):
        frappe.throw(
            _(
                "Le modèle d'e-mail « {0} » est introuvable. Exécutez un bench migrate (fixtures)"
                " ou créez le modèle."
            ).format(EMAIL_TEMPLATE_NAME)
        )
    return frappe.get_doc("Email Template", EMAIL_TEMPLATE_NAME)


@frappe.whitelist()
def get_contact_email_for_customer(customer: str) -> str | None:
    """Retourne un e-mail d'un contact lié au client, en privilégiant le contact principal."""
    if not customer or not frappe.has_permission("Customer", "read", customer):
        return None
    row = frappe.db.sql(
        """
		select c.email_id
		from `tabContact` c
		inner join `tabDynamic Link` dl
			on dl.parent = c.name and dl.parenttype = 'Contact' and dl.link_doctype = 'Customer'
		where dl.link_name = %s
			and ifnull(c.email_id, '') != ''
		order by c.is_primary_contact desc, c.name asc
		limit 1
		""",
        (customer,),
    )
    if not row or not row[0][0]:
        return None
    return str(row[0][0]).strip()


@frappe.whitelist()
def generate_customer_upload_link(
    customer: str,
    requested_file: str,
    description: str | None = None,
    recipient_email: str | None = None,
) -> dict[str, Any]:
    """
    Assure le dossier client, crée le lien de dépôt, envoie l'e-mail (le mot de passe n'y figure que dans le
    message) et retourne des métadonnées à l'UI (sans le mot de passe, pour limiter l'exposition réseau).
    """
    if not customer:
        frappe.throw(_("Aucun client spécifié."))
    if not requested_file or not str(requested_file).strip():
        frappe.throw(_("Veuillez indiquer le nom du fichier demandé."))
    if not recipient_email or not str(recipient_email).strip():
        frappe.throw(_("L'adresse e-mail du destinataire est obligatoire."))
    recipient_email = str(recipient_email).strip()
    if not frappe.utils.validate_email_address(recipient_email, throw=False):
        frappe.throw(_("Adresse e-mail du destinataire invalide."))
    if not frappe.has_permission("Customer", "write", customer):
        frappe.throw(_("Vous n'avez pas la permission de gérer ce client."))

    url_folder = ensure_customer_folder(customer)
    doc = frappe.get_doc("Customer", customer)
    folder = build_folder_name(doc)
    pwd = generate_secure_password(12)
    sh = create_upload_link(
        folder_name=folder,
        subpath=None,
        password=pwd,
        label=str(requested_file).strip()[:512],
        expire_days=7,
    )
    et = _get_email_template()
    exp_display = sh.get("expiration") or ""
    context = {
        "doc": doc.as_dict(),
        "requested_file": str(requested_file).strip(),
        "description": (description or "").strip(),
        "upload_url": sh["url"],
        "upload_password": pwd,
        "upload_expiration": exp_display,
        "site_url": get_url().rstrip("/"),
        # JSON JS valide pour prompt(…, mot_de_passe) dans l’e-mail (guillemets simples sur le href)
        "upload_password_js": json.dumps(pwd),
    }
    out = et.get_formatted_email(context)
    try:
        frappe.sendmail(
            recipients=[recipient_email],
            subject=out["subject"],
            message=out["message"],
            reference_doctype="Customer",
            reference_name=customer,
        )
    except Exception:
        frappe.log_error(message=frappe.get_traceback(), title="Nextcloud: envoi e-mail")
        frappe.throw(
            _(
                "Le lien a été généré mais l'envoi de l'e-mail a échoué. Vérifiez le compte e-mail de"
                " l'instance."
            )
        )
    # Le mot de passe n’est pas renvoyé à l’UI (déjà dans l’e-mail) pour éviter exposition réseau.
    return {
        "upload_url": sh["url"],
        "expiration": exp_display,
        "email_sent_to": recipient_email,
        "folder_name": folder,
        "nextcloud_folder_url": url_folder,
    }


def on_customer_after_insert(doc, method=None) -> None:
    """Hook Customer : ne bloque jamais la sauvegarde (tâche en file)."""
    if getattr(doc, "doctype", None) != "Customer" or not doc.get("name"):
        return
    frappe.enqueue(
        "aurescrm.integrations.nextcloud.ensure_customer_folder_safe",
        queue="short",
        job_id=f"nextcloud-ensure:{doc.name}"[:100],
        customer=doc.name,
    )


def ensure_customer_folder_safe(customer: str) -> None:
    """
    Tâche en arrière-plan : création de dossier sans bloquer. Erreurs → ``log_error`` uniquement
    (ne pas propager, sinon la file marque l'échec de façon agressive sur certaines config).
    """
    try:
        ensure_customer_folder(customer)
    except Exception:
        frappe.log_error(
            message=frappe.get_traceback(),
            title=f"Nextcloud (ensure_customer_folder) — {customer}",
        )


def refresh_customer_folder_url(customer: str) -> str | None:
    """
    Force la résolution via PROPFIND du ``fileid`` et met à jour ``nextcloud_folder_url`` au
    format persistant ``/f/<id>``. Utilisable lors d'une migration ou d'un renommage manuel.
    """
    if not customer or not frappe.db.exists("Customer", customer):
        return None
    if not frappe.get_meta("Customer").has_field("nextcloud_folder_url"):
        return None
    doc = frappe.get_doc("Customer", customer)
    fname = build_folder_name(doc)
    cfg = _get_config()
    path = f"{cfg['nextcloud_base_folder']}/{fname}"
    fileid = _propfind_fileid(path)
    if not fileid:
        return None
    new_url = _folder_id_url(fileid)
    frappe.db.set_value("Customer", customer, "nextcloud_folder_url", new_url, update_modified=False)
    return new_url


def bulk_create_folders_for_all_customers(dry_run: bool | str | int = False) -> dict[str, Any]:
    """
    Parcourt les clients actifs, crée les dossiers manquants (hors liens de dépôt). Utilisable
    en migration ou via ``bench execute`` ; ``dry_run`` en JSON pour simulation sans création.
    """
    if isinstance(dry_run, str):
        dry_run = dry_run.lower() in ("1", "true", "yes", "y")
    dry_run = bool(cint(dry_run))

    customers = frappe.get_all(
        "Customer",
        filters={"disabled": 0},
        pluck="name",
        order_by="name asc",
    )
    total = len(customers)
    n_created = 0
    n_skipped = 0
    n_upgraded = 0
    n_err = 0
    _log = frappe.logger("aurescrm.nextcloud", allow_site=True, file_count=1)
    has_field = frappe.get_meta("Customer").has_field("nextcloud_folder_url")
    for i, cname in enumerate(customers, start=1):
        if not (i % 50):
            _log.info("Nextcloud bulk: %s / %s clients", i, total)
        existing_url = None
        if has_field:
            existing_url = frappe.db.get_value("Customer", cname, "nextcloud_folder_url") or None
        if existing_url and "/f/" in existing_url:
            n_skipped += 1
            continue
        if existing_url and "/f/" not in existing_url:
            if dry_run:
                _log.info("dry_run: migration URL de %s", cname)
                continue
            try:
                if refresh_customer_folder_url(cname):
                    n_upgraded += 1
                else:
                    n_skipped += 1
            except Exception:
                n_err += 1
                frappe.log_error(
                    message=frappe.get_traceback(),
                    title=f"Nextcloud bulk (refresh) — {cname}",
                )
            continue
        if dry_run:
            _log.info("dry_run: simulerait %s", cname)
            continue
        try:
            ensure_customer_folder(cname)
            n_created += 1
        except Exception:
            n_err += 1
            frappe.log_error(
                message=frappe.get_traceback(),
                title=f"Nextcloud bulk — {cname}",
            )
    return {
        "total": total,
        "dossiers_crees": n_created,
        "url_mises_a_niveau_fileid": n_upgraded,
        "deja_persistantes_ou_ignorees": n_skipped,
        "erreurs": n_err,
        "dry_run": dry_run,
    }
