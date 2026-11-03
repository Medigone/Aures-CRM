"""Transport Web Push auto-hébergé : chiffrement RFC 8291 et authentification VAPID RFC 8292.

Repris de MediConnect (mediconnect/push/webpush.py) : pas de `pywebpush`, dont la dépendance `py_vapid` exige
`cryptography>=47` alors que Frappe épingle `cryptography~=44`. Seuls `cryptography` et `requests` servent.
"""

from __future__ import annotations

import base64
import json
import os
import struct
import time
from dataclasses import dataclass
from urllib.parse import urlparse

import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

# The push service must accept a whole record; browsers guarantee at least 4096 bytes.
RECORD_SIZE = 4096
# 16 GCM tag + 1 padding delimiter + 16 salt + 4 rs + 1 idlen + 65 key.
MAX_PAYLOAD_BYTES = RECORD_SIZE - 103
VAPID_TOKEN_TTL_SECONDS = 12 * 60 * 60


class WebPushError(Exception):
	"""Raised when a push service refuses the message."""

	def __init__(self, message: str, status_code: int | None = None):
		super().__init__(message)
		self.status_code = status_code

	@property
	def is_gone(self) -> bool:
		"""404/410 mean the subscription is dead and should be dropped, not retried."""
		return self.status_code in (404, 410)


@dataclass(frozen=True)
class PushSubscriptionKeys:
	endpoint: str
	p256dh: str
	auth: str


# Services push des navigateurs. L'endpoint vient du client : sans cette liste, le serveur
# enverrait des POST vers n'importe quelle adresse HTTPS, y compris interne (SSRF).
PUSH_SERVICE_HOSTS = (
	"fcm.googleapis.com",
	"android.googleapis.com",
	"updates.push.services.mozilla.com",
	"web.push.apple.com",
)
PUSH_SERVICE_SUFFIXES = (
	".push.services.mozilla.com",
	".push.apple.com",
	".notify.windows.com",
)


def is_allowed_push_endpoint(endpoint: str) -> bool:
	"""Endpoint HTTPS d'un service push connu, sans identifiants ni port explicite."""
	try:
		parsed = urlparse(endpoint or "")
		port = parsed.port
	except ValueError:
		return False
	host = (parsed.hostname or "").lower()
	if parsed.scheme != "https" or not host or parsed.username or parsed.password or port not in (None, 443):
		return False
	return host in PUSH_SERVICE_HOSTS or host.endswith(PUSH_SERVICE_SUFFIXES)


def b64url_encode(raw: bytes) -> str:
	return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def b64url_decode(value: str) -> bytes:
	padding = "=" * (-len(value) % 4)
	return base64.urlsafe_b64decode(value + padding)


def generate_vapid_keypair() -> tuple[str, str]:
	"""Return (private_key, public_key), both base64url, in the usual VAPID shapes."""
	private_key = ec.generate_private_key(ec.SECP256R1())
	private_raw = private_key.private_numbers().private_value.to_bytes(32, "big")
	public_raw = private_key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
	return b64url_encode(private_raw), b64url_encode(public_raw)


def _load_private_key(private_key_b64: str) -> ec.EllipticCurvePrivateKey:
	return ec.derive_private_key(int.from_bytes(b64url_decode(private_key_b64), "big"), ec.SECP256R1())


def _hkdf(salt: bytes, ikm: bytes, info: bytes, length: int) -> bytes:
	return HKDF(algorithm=hashes.SHA256(), length=length, salt=salt, info=info).derive(ikm)


def encrypt_payload(
	payload: bytes,
	p256dh: str,
	auth: str,
	*,
	as_private: ec.EllipticCurvePrivateKey | None = None,
	salt: bytes | None = None,
) -> bytes:
	"""Encrypt `payload` for one subscription using aes128gcm (RFC 8188 + RFC 8291).

	`as_private` and `salt` exist so tests can replay the RFC 8291 vector; production
	callers leave them out and get fresh randomness per message.
	"""
	if len(payload) > MAX_PAYLOAD_BYTES:
		raise WebPushError(f"Push payload exceeds {MAX_PAYLOAD_BYTES} bytes")

	ua_public_raw = b64url_decode(p256dh)
	auth_secret = b64url_decode(auth)
	ua_public = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_public_raw)

	as_private = as_private or ec.generate_private_key(ec.SECP256R1())
	as_public_raw = as_private.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)

	shared_secret = as_private.exchange(ec.ECDH(), ua_public)
	prk = _hkdf(
		salt=auth_secret,
		ikm=shared_secret,
		info=b"WebPush: info\x00" + ua_public_raw + as_public_raw,
		length=32,
	)

	salt = salt or os.urandom(16)
	content_key = _hkdf(salt, prk, b"Content-Encoding: aes128gcm\x00", 16)
	nonce = _hkdf(salt, prk, b"Content-Encoding: nonce\x00", 12)

	# 0x02 is the "last record" delimiter; there is exactly one record here.
	ciphertext = AESGCM(content_key).encrypt(nonce, payload + b"\x02", None)

	header = salt + struct.pack("!I", RECORD_SIZE) + bytes([len(as_public_raw)]) + as_public_raw
	return header + ciphertext


def build_vapid_header(endpoint: str, private_key_b64: str, public_key_b64: str, subject: str) -> str:
	"""Build the `Authorization: vapid t=…,k=…` header for one push service origin."""
	parsed = urlparse(endpoint)
	audience = f"{parsed.scheme}://{parsed.netloc}"

	header = {"typ": "JWT", "alg": "ES256"}
	claims = {
		"aud": audience,
		"exp": int(time.time()) + VAPID_TOKEN_TTL_SECONDS,
		"sub": subject,
	}
	signing_input = b".".join(
		b64url_encode(json.dumps(part, separators=(",", ":")).encode("utf-8")).encode("ascii")
		for part in (header, claims)
	)

	der_signature = _load_private_key(private_key_b64).sign(signing_input, ec.ECDSA(hashes.SHA256()))
	r, s = decode_dss_signature(der_signature)
	raw_signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")

	token = signing_input.decode("ascii") + "." + b64url_encode(raw_signature)
	return f"vapid t={token},k={public_key_b64}"


def send_web_push(
	subscription: PushSubscriptionKeys,
	payload: dict,
	*,
	vapid_private_key: str,
	vapid_public_key: str,
	vapid_subject: str,
	ttl: int = 86_400,
	urgency: str = "normal",
	timeout: int = 10,
) -> None:
	"""Deliver one notification. Raises WebPushError on any non-2xx answer."""
	body = encrypt_payload(
		json.dumps(payload, separators=(",", ":")).encode("utf-8"),
		subscription.p256dh,
		subscription.auth,
	)
	headers = {
		"Authorization": build_vapid_header(
			subscription.endpoint, vapid_private_key, vapid_public_key, vapid_subject
		),
		"Content-Encoding": "aes128gcm",
		"Content-Type": "application/octet-stream",
		"TTL": str(ttl),
		"Urgency": urgency,
	}

	if not is_allowed_push_endpoint(subscription.endpoint):
		raise WebPushError("Push endpoint not allowed", status_code=410)
	try:
		response = requests.post(
			subscription.endpoint, data=body, headers=headers, timeout=timeout, allow_redirects=False
		)
	except requests.RequestException as exc:
		raise WebPushError(f"Push service unreachable: {exc}") from exc

	if response.status_code >= 300:
		raise WebPushError(
			f"Push service returned {response.status_code}: {response.text[:300]}",
			status_code=response.status_code,
		)
