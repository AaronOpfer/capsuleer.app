# capsuleer.app


This is/was the source code for [capsuleer.app](https://capsuleer.app), an application for managing EVE Online characters. It's primarily written in Python (heavy asyncio usage), and the front-end is React/Typescript with webpack.

# How well is capsuleer.app maintained?

The main body of code for capsuleer.app was written during an extended leave from work. Since then, new features, fixes and improvements come when I have free time. I do try to quickly fix critical bugs that prevent the site from functioning at all, such as ESI changes.

The source code is available so that others can run their own private versions and so that there is less risk of the application becoming dead.

# Contributions

I recommend those who would want to make contributions contact me and ask first what sorts of contributions I would be willing to accept before they begin work; this would give the greatest amount of respect for everyone's time involved. I have limited capacity to accept pull requests.

# Development / Deployment Outline

## Example Configurations

Everything that ends with `.example` is a configuration that you will need to copy and modify to suit your local environment.

## ESI Registration

[You will need to create an application with EVE](https://developers.eveonline.com/applications) and get the `client_id` and `client_secret`, and install them into `esi.conf`. You'll need to specify a callback URL with CCP; It should be `<http or https>://<whatever your canonical hostname is>/callback`.

## Runtimes

To install both the backend server requirements and the `node`/`npm` used for the front-end build, we use [`pixi`](https://github.com/prefix-dev/pixi).

### Python

Python 3.12 is required to run the main webserver and several "offline" scripts. It's likely newer versions than Python 3.12 will work too. The runtime environment for the webserver can be installed simply with `pixi install`.

### JavaScript

Node 20.17.0 is required. It's likely newer versions will work too (20.17.0 was LTS at time of writing). The correct version of `node` is installed when using `pixi` as described above. A production build can of the front-end can be made with `npx webpack --config webpack.prod.js`. Production builds include source maps (this is an open-source project after all).

## Postgres

Postgres 15 is what is currently being used to run this application. It seems likely that a wide variety of versions will work, as our usage of postgres is generally not sophisticated. A schema dump can be found in `schema.sql`.

For now, sourcing a postgres database is up to the deployment. On the real deployed site, we use the Postgres available in Debian repositories.

## `capsuleerapp.offline` modules

The offline module contains scripts for generating static data used by various parts of the app.

 * `implant_search.py` creates the static data necessary to determine which implant IDs correspond to which attribute bonus. When new implants are added, this script needs to be rerun.
 * `all_forge_npc.py` determines all station IDs for NPC stations in The Forge, necessary for the market price estimator feature to differentiate citadels and stations. New NPC stations are not very common; the last one was for Paragon/NPE.
 * `dump_skills.py` creates a static JSON file used by the JavaScript build so that the local client has complete knowledge of the skills available in EVE Online. *This means that the front-end needs to be rebuilt every time CCP adds more skills to the game.*

## Setting up the NPC Corporation Character Token

In order to scan public citadel markets, a one-time setup of adding a character who is in an NPC corporation to the site who also has the additional `esi-markets.structure_markets.v1` scope must be performed. This is because there is techincally no such thing as a "public" Citaldel: Citadel ACL rules can be whitelists or blacklists, and so market queries must occur on behalf of a character in order to avoid returning private market data to anybody. Therefore our definition of a "public" Citadel is one that allows trade with characters in NPC/Newbie Corporations, since presumably anyone on the blacklist could create an alt and make a purchase that way.

In order to add this character, use an incognito window and use the normal SSO flow until you've reached the "Authorize" button. Then, doctor the URL to include the `esi-markets.structure_markets.v1` scope and reload. Finally, determine the internal account ID that capsuleer.app allocated for this character and place it in esi.conf as `internal_account_id` config entry.

If you log into this account and again in the future, the `esi-markets.structure_markets.v1` scope will be added to the URL automatically.

## Persistent Components

#### supervisor

I'm using supervisor to start and run all daemons, except for nginx and postgres. Supervisor comes from pixi, but can also come from Debian.

#### `capsuleerapp` app server

This is the python server used to render the webapp for users.

#### postgresql database

I'm using postgres to store character tokens and user profiles.

#### Varnish

I'm using varnish to cache ESI API responses. This should theoretically let me run several instances of the application server behind a load balancer (which I've never actually tried).

#### stunnel

`stunnel` is used to connect Varnish to the HTTPS ESI API without having to pay for Varnish Pro.

## Component Connections

`nginx` communicates with the `esi` application via an HTTP server started on a unix socket.

`esi` communicates with `postgres` and `varnish`. `varnish` listens on a localhost TCP port. It would be nice if this also used a unix socket.

`varnish` communicates with `stunnel` over another localhost TCP port. Again, would be nice is this was a unix socket instead.

Finally, `stunnel` communicates to the official ESI API.


# License

[MIT License](https://opensource.org/licenses/MIT)
