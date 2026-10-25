# Engineering Studio — project bucket list

Updated 26 October 2026. Saved at the owner's request.

This is a backlog for future work, not a statement that these features are complete or currently being implemented. The existing delivery checklist remains in [PRIORITY_CHECKLIST.md](PRIORITY_CHECKLIST.md).

## Business direction

Help a user complete a useful hardware project: idea → editable model → component list → review/export package.

Suggested first audience to validate: student and maker teams working on IoT enclosures, electronics packaging and small robotic assemblies. Engines, ships and the other project categories remain part of the broader vision.

## Feature bucket list

| Priority | Item | Intended outcome | Current starting point |
| --- | --- | --- | --- |
| First | Guided project creator | Enter dimensions, choose components and obtain an editable starting model. | Category browsing exists; category-specific generation is not implemented. |
| First | Complete starter projects | LoRa enclosure, sensor housing and small robot assemblies with clear steps. | Existing generic starters and a drone concept provide a foundation; these new complete workflows are pending. |
| First | Dimensioned component library | Boards, motors, batteries and fasteners with sourced dimensions and traceable component references. | Generic concept parts exist; a sourced component library remains to be built. |
| First | Project handoff package | Model files, dimensioned views, BOM and assembly instructions in one export package. | Reuse existing STL/OBJ, BOM and report exports; expand and package the handoff workflow. |
| Launch essential | Reliable private cloud projects | Save across devices, recover revisions and invite reviewers. | Backend foundations exist in source; hosted acceptance remains outstanding. |
| Early | Interactive learning | Short guided tasks help beginners complete a first successful design. | Existing guide/help can support interactive onboarding. |
| Later | Classroom and team workspace | Assign projects, submit designs and receive teacher/team feedback. | Existing account/team permissions provide a foundation; classroom workflows are pending. |
| Later | Fabrication quotation requests | Prepare a review package for a printing or fabrication partner. | Partner workflow, quotation handling and acceptance criteria are pending. An export is not manufacturing certification. |
| After regular usage | Template and parts marketplace | Creators publish reusable project packs and components. | Creator publishing, licensing, moderation and transaction workflows are pending. |

## Launch and operating essentials

- [ ] Deploy the backend using the free-tier-first setup, with PostgreSQL, HTTPS and correct environment configuration.
- [ ] Verify account signup, email verification, recovery, sessions and cloud saves on real accounts/devices.
- [ ] Rehearse backup/restore and define monitoring, incident recovery and service limits.
- [ ] Validate hosted collaboration, permissions, conflicts and reconnect behaviour on PostgreSQL.
- [ ] Provide customer support, useful help content and a feedback/issue-reporting workflow.
- [ ] Complete real payment-provider sandbox acceptance and clear billing/cancellation flows before any live charging.
- [ ] Monitor operating costs, including storage, email, compute and any future AI usage.
- [ ] Validate exports in external CAD/slicer software and document physical acceptance where relevant.

## First pilot milestone

- [ ] Prepare one complete LoRa enclosure workflow: choose dimensions/components → edit the enclosure → save → export the review package.
- [ ] Recruit 10–20 pilot users after the workflow is ready and collect their feedback.
- [ ] Record whether users can finish without assistance, where they get stuck and how much support they need.
- [ ] Measure time to first saved model, successful exports and repeat usage.
- [ ] Ask about willingness to pay and use the findings to select the next features and commercial offer.

The pilot size is a proposed experiment, not a user count already achieved or a promise of demand.

## Revenue ideas for the owner's later decision

- [ ] Individual subscriptions.
- [ ] School/team licences.
- [ ] One-time project/template packs.
- [ ] Consider fabrication referral arrangements and a creator marketplace after there is regular usage and an agreed partner model.

No prices or new Free/Premium assignments are set by this plan. The owner will specify what belongs in Premium later. Existing plan rules remain unchanged, and this backlog does not authorize paid infrastructure or live charging.

## Related project records

- [Current roadmap and remaining work](PROJECT_STATUS_AND_ROADMAP.md)
- [Delivery priorities and verification history](PRIORITY_CHECKLIST.md)
- [Current Free/Pro feature split](FREE_AND_PRO.md)
- [Current category-options scope](V15_6_PROJECT_OPTIONS.md)
