## 1. Intake and UI contract

- [x] 1.1 Classify document-driven intake as required and reuse the reviewed H5 demo as the accepted reference
- [x] 1.2 Record direct adoption, Mini Program adaptations, reverse-thinking card, and acceptance boundaries

## 2. Visual implementation

- [x] 2.1 Align native app/page chrome with the H5 visual tokens and custom page headers
- [x] 2.2 Restyle results page while preserving source, reason, uncertainty, favorite, adoption, detail, and map actions
- [x] 2.3 Restyle detail page while preserving departure, map, schedule, risks, favorite, and feedback actions
- [x] 2.4 Restyle feedback page while preserving correction and route-sharing modes
- [x] 2.5 Verify the existing home page against the accepted H5 token set and keep its search behavior intact

## 3. Quality gates

- [x] 3.1 Run JSON, JavaScript, WXML, WXSS, and page-event static checks
- [x] 3.2 Review scope and Mini Program compatibility locally (fallback_local_only; independent review remains pending)
- [x] 3.3 Complete local QA and post-execution diagnosis with explicit evidence limits
- [x] 3.4 Record scoped local review outcome and pending independent / native acceptance

## 4. Repeated-feedback correction

- [x] 4.1 Locate actual v2 button selector and reproduce pre-fix 184px widths
- [x] 4.2 Raise page-button specificity, preserve state overrides, replace HTML br
- [x] 4.3 Pass 84 compiled-output layouts with portrait, geometry and selected-color assertions
- [x] 4.4 Correct prior QA/diagnosis/reviewer claims, repair baseline references and record KPI candidate
- [ ] 4.5 Complete independent reviewer and WeChat IDE/device visual and interaction acceptance

## 5. Full H5 demo translation re-entry

- [x] 5.1 Restore the home origin/departure context card and keep both existing picker flows reachable
- [x] 5.2 Restore detail route rhythm, information-boundary, and preparation content from the existing view model
- [x] 5.3 Add responsive H5-style bottom navigation using only existing Mini Program page paths
- [x] 5.4 Update the UI contract, traceability, QA, diagnosis, and reviewer records so they describe the complete redesign rather than the earlier button-only correction
- [ ] 5.5 Complete independent reviewer and WeChat IDE/device visual and interaction acceptance for the full four-page journey

## 6. Structural simplification pass

- [x] 6.1 Remove repeated home support/preview panels and keep optional filters collapsed behind one link
- [x] 6.2 Remove duplicate results source/boundary strips while retaining per-route source, reason, facts, and warning
- [x] 6.3 Merge detail support content into one pre-departure section and keep the schedule short
- [x] 6.4 Collapse feedback into a single-column short form and remove the explanatory intro column
- [x] 6.5 Remove persistent bottom navigation and preserve contextual back/action links
- [ ] 6.6 Complete native WeChat visual, safe-area, keyboard, and touch acceptance

## 7. Outdoor visual field and client adapter

- [x] 7.1 Add sky, grass, water, and warm-light gradients to the four Mini Program page backgrounds while keeping content surfaces readable
- [x] 7.2 Normalize nested recommendation/detail responses and compatible source/coordinate aliases in the client adapter without changing backend endpoints
- [x] 7.3 Verify adapter behavior with syntax checks and a nested-response fixture
- [ ] 7.4 Re-run native WeChat visual, safe-area, keyboard, touch, and live API acceptance
