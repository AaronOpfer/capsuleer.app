"""
Handles JWT decoding -- quite a bit of this file was copied directly from 
the documentation here:
https://developers.eveonline.com/docs/services/sso/?h=sso#validating-jwt-tokens

With the major changes being to swap out the ancient python2-based 'jose'
for a modern jwt library.
"""

import cachetools
import requests
import time

import jwt

METADATA_URL = "https://login.eveonline.com/.well-known/oauth-authorization-server"
METADATA_CACHE_TIME = 300
ACCEPTED_ISSUERS = ("logineveonline.com", "https://login.eveonline.com")
EXPECTED_AUDIENCE = "EVE Online"

jwks_client = None

@cachetools.cached(cache=cachetools.TTLCache(1000, 300))
def _fetch_jwks_key(token) -> str:
    global jwks_client
    if jwks_client is None:
        resp = requests.get(METADATA_URL)
        resp.raise_for_status()
        metadata = resp.json()
        jwks_client = jwt.PyJWKClient(metadata["jwks_uri"])

    signing_key = jwks_client.get_signing_key_from_jwt(token)
    return signing_key


def _validate_jwt_token(token):
    """
    Validates a JWT Token.

    :param str token: The JWT token to validate
    :returns: The content of the validated JWT access token
    :raises ExpiredSignatureError: If the token has expired
    :raises JWTError: If the token is invalid
    """
    header = jwt.get_unverified_header(token)
    return jwt.decode(
        token,
        key=_fetch_jwks_key(token),
        algorithms=header["alg"],
        issuer=ACCEPTED_ISSUERS,
        audience=EXPECTED_AUDIENCE,
    )


def is_token_valid(client_id, token) -> (bool, list):
    """
    Simple check if the token is valid or not.

    :returns: True if the token is valid, False otherwise
    """
    try:
        claims = _validate_jwt_token(token)
        return client_id in claims["aud"], claims
    except jwt.ExpiredSignatureError:
        return False, None
    except jwt.InvalidSignatureError:
        return False, None
    except jwt.InvalidTokenError:
        return False, None
    except Exception:
        return False, None
