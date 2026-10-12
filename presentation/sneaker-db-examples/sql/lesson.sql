\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA sneaker_lesson_session;
SET LOCAL search_path TO sneaker_lesson_session;
\ir schema.sql
\ir seed.sql
\ir read.sql
\ir join.sql
\ir change.sql
ROLLBACK;
