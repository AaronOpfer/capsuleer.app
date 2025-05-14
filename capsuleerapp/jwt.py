import requests
import time

import jwt

METADATA_URL = "https://login.eveonline.com/.well-known/oauth-authorization-server"
METADATA_CACHE_TIME = 300  # 5 minutes
ACCEPTED_ISSUERS = ("logineveonline.com", "https://login.eveonline.com")
EXPECTED_AUDIENCE = "EVE Online"

# We don't want to fetch the jwks data on every request, so we cache it for a short period
jwks_metadata = None
jwks_metadata_ttl = 0


def fetch_jwks_metadata():
    """
    Fetches the JWKS metadata from the SSO server.

    :returns: The JWKS metadata
    """
    global jwks_metadata, jwks_metadata_ttl
    if jwks_metadata is None or jwks_metadata_ttl < time.time():
        resp = requests.get(METADATA_URL)
        resp.raise_for_status()
        metadata = resp.json()

        jwks_uri = metadata["jwks_uri"]

    return jwks_uri


def validate_jwt_token(token):
    """
    Validates a JWT Token.

    :param str token: The JWT token to validate
    :returns: The content of the validated JWT access token
    :raises ExpiredSignatureError: If the token has expired
    :raises JWTError: If the token is invalid
    """
    # url = "https://dev-87evx9ru.auth0.com/.well-known/jwks.json"

    optional_custom_headers = {"User-agent": "custom-user-agent"}

    jwks_client = jwt.PyJWKClient(fetch_jwks_metadata(), headers=optional_custom_headers)

    signing_key = jwks_client.get_signing_key_from_jwt(token)

    # metadata = fetch_jwks_metadata()
    # keys = metadata["keys"]
    # Fetch the key algorithm and key idfentifier from the token header
    header = jwt.get_unverified_header(token)
    # key = [
    #     item
    #     for item in keys
    #     if item["kid"] == header["kid"] and item["alg"] == header["alg"]
    # ].pop()
    return jwt.decode(
        token,
        key=signing_key,
        algorithms=header["alg"],
        issuer=ACCEPTED_ISSUERS,
        audience=EXPECTED_AUDIENCE,
    )


def is_token_valid(client_id, token):
    """
    Simple check if the token is valid or not.

    :returns: True if the token is valid, False otherwise
    """
    try:
        claims = validate_jwt_token(token)
        # If our client_id is in the audience list, the token is valid, otherwise, we got a token for another client.
        return client_id in claims["aud"], claims
    except jwt.ExpiredSignatureError:
        print("JWT has expired")
        return False, None
    except jwt.InvalidSignatureError:
        print("Invalid signature")
        return False, None
    except jwt.InvalidTokenError:
        print("Invalid token")
        return False, None
    except Exception:
        # Something went wrong
        return False, None
