# capsuleer.app


This is/was the source code for [capsuleer.app](https://capsuleer.app), an application for managing EVE Online characters. It's primarily written in Python (heavy asyncio usage), and the front-end is React/Typescript with webpack.

# Why doesn't capsuleer.app work right now?

Could be any number of reasons, but they all come down to the fact that I don't have the time to care for it; I don't play EVE Online anymore and this project was created when I had less going on in life. The source code is available so that others can run their own private versions.

# Contributions

I recommend those who would want to make contributions contact me and ask first what sorts of contributions I would be willing to accept before they begin work; this would give the greatest amount of respect for everyone's time involved. I have limited capacity to accept pull requests.

## Persistent Components

#### supervisor

I'm using supervisor to start and run all daemons, except for nginx, which comes from the Debian system.

#### `esi` app server

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
