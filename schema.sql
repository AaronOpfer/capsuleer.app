--
-- PostgreSQL database dump
--

-- Dumped from database version 11.11 (Debian 11.11-0+deb10u1)
-- Dumped by pg_dump version 11.11 (Debian 11.11-0+deb10u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: account_id_seq; Type: SEQUENCE; Schema: public; Owner: x
--

CREATE SEQUENCE public.account_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.account_id_seq OWNER TO x;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: account; Type: TABLE; Schema: public; Owner: x
--

CREATE TABLE public.account (
    id integer DEFAULT nextval('public.account_id_seq'::regclass) NOT NULL,
    create_time timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.account OWNER TO x;

--
-- Name: TABLE account; Type: COMMENT; Schema: public; Owner: x
--

COMMENT ON TABLE public.account IS 'An account is a collection of characters that can be monitored by a single session.

A user logs into an account by logging into any EVE character associated with that account via EVE SSO. If a character has never been associated with an account before, a new account is created at that time.';


--
-- Name: character; Type: TABLE; Schema: public; Owner: x
--

CREATE TABLE public."character" (
    character_id bigint NOT NULL,
    account_id integer NOT NULL,
    access_token text,
    refresh_token text,
    access_token_expires timestamp with time zone,
    name name NOT NULL,
    create_time timestamp with time zone DEFAULT now() NOT NULL,
    owner_hash text NOT NULL
);


ALTER TABLE public."character" OWNER TO x;

--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: x
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: character character_pkey; Type: CONSTRAINT; Schema: public; Owner: x
--

ALTER TABLE ONLY public."character"
    ADD CONSTRAINT character_pkey PRIMARY KEY (character_id);


--
-- Name: character character_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: x
--

ALTER TABLE ONLY public."character"
    ADD CONSTRAINT character_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- PostgreSQL database dump complete
--
