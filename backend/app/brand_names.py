def brand_name(name: str) -> str:
    """Normalize labels without changing existing brand IDs or product links."""
    name = name.strip()
    if name.replace(" ", "").upper() in {"엘에이기어", "LA기어", "LAGEAR"}:
        return "LA기어"
    return name
