"""Geração de payload PIX (BR Code / EMV QR Code) — Bacen."""
from typing import Optional
import unicodedata


def _tlv(idv: str, value: str) -> str:
    return f"{idv}{len(value):02d}{value}"


def _sanitize(text: str, limit: int) -> str:
    """Normaliza para ASCII para atender ao padrão EMV."""
    n = unicodedata.normalize("NFKD", text)
    ascii_only = n.encode("ascii", "ignore").decode("ascii")
    return ascii_only[:limit].strip() or "PAGAMENTO"


def _crc16(payload: str) -> str:
    crc = 0xFFFF
    for ch in payload.encode("utf-8"):
        crc ^= ch << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def _normalize_phone_key(key: str) -> str:
    """Chave celular precisa estar em E.164 (+5581999999577)."""
    digits = "".join(c for c in key if c.isdigit())
    if key.strip().startswith("+"):
        return key.strip()
    if len(digits) == 11:  # DDD + número BR
        return f"+55{digits}"
    if len(digits) == 13 and digits.startswith("55"):
        return f"+{digits}"
    return key.strip()


def build_pix_payload(
    *,
    key: str,
    amount: Optional[float] = None,
    merchant_name: str = "Roteira",
    merchant_city: str = "RECIFE",
    txid: str = "***",
    key_type: str = "Celular",
) -> str:
    """Constrói o BR Code (Copia e Cola) do PIX."""
    if key_type.lower() in ("celular", "phone", "telefone"):
        key = _normalize_phone_key(key)

    merchant_account = _tlv("00", "br.gov.bcb.pix") + _tlv("01", key)
    mai = _tlv("26", merchant_account)

    parts = [
        _tlv("00", "01"),         # payload format
        _tlv("01", "12"),         # static-but-may-change  (12 = pode ser reutilizado várias vezes)
        mai,
        _tlv("52", "0000"),       # MCC
        _tlv("53", "986"),        # BRL
    ]
    if amount is not None and amount > 0:
        parts.append(_tlv("54", f"{amount:.2f}"))
    parts.append(_tlv("58", "BR"))
    parts.append(_tlv("59", _sanitize(merchant_name, 25)))
    parts.append(_tlv("60", _sanitize(merchant_city, 15)))
    parts.append(_tlv("62", _tlv("05", _sanitize(txid, 25) or "***")))

    partial = "".join(parts) + "6304"
    return partial + _crc16(partial)
