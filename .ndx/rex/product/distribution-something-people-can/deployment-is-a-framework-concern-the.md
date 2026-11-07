---
id: "bb2b2aea-ce57-48db-8e9c-a1d886fdc5b1"
type: "capability"
title: "Deployment is a framework concern: the ship subpackage"
slug: "deployment-is-a-framework-concern-the"
statement: "The ship subpackage gives every Graview deployment, hosted or self-hosted, persistence, op-log-native migrations, build and export, configuration and health checks from one declaration, with multi-tenant operation left to the separate cloud service."
criteria: [{"id":"c1","text":"The @graview/ship package shall provide persistence adapters, schema and data migrations, app build and export, config and principal/auth wiring, and health checks for every deployment, hosted or self-hosted."},{"id":"c2","text":"When a schema change ships, the migration shall be applied as logged ops that are authored, replayable and undoable in the same vocabulary as every other change."},{"id":"c3","text":"When graview check runs on a declaration, graview check shall verify that the declaration's migrations cover its schema version history."},{"id":"c4","text":"When a self-hoster combines one defineApp declaration with ship, ship shall produce a deployable artefact with persistence and versioning and without requiring a service."},{"id":"c5","text":"The framework shall keep everything a self-hoster needs in ship and leave what only the operator of a multi-tenant service needs to the graview-cloud repository."},{"id":"c6","text":"The @graview/ship package shall be versioned and published like the other packages, with changesets and CI."}]
tags:
  - "deployment"
  - "migrations"
  - "persistence"
  - "ops"
  - "sdk"
source: "Nick, 2026-09-01: \"some amount of deployment help/opinionation could/should live in the framework as well. is it a subpackage for the deployment components (incl shit like data migrations), and then a separate repo for graview-saas...\""
priority: "high"
---

The framework-side half of the SaaS ambition, and useful without it. Today an app built on Graview has no story for persistence beyond an adapter nobody uses, no data migrations when a schema evolves, and no opinion about how a deployment is built, configured, upgraded or health-checked. That story belongs in the framework — it must evolve in lockstep with core's schema and op log (migrations are fundamentally an op-log concern), and self-hosters need it exactly as much as a hosted service does.

The dividing rule with the sibling graview-cloud repo: ship = what one deployment needs; saas = what operating many deployments for other people needs (tenancy, provisioning, deploy-to-URL, billing, fleet upgrades, the builder UX). The service consumes ship the way any customer would, through the published packages.
