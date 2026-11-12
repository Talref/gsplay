# Dependency security maintenance

## November 2026 review

Mongoose is required at `^8.24.8` to include the fixes for Dependabot alerts
#224–228, including #225's `countDocuments` filter sanitization vulnerability.

The backend development dependency overrides address
[minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249)
and [glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4):

- `glob@>=9` uses `14.0.2`, the first patched release for cancellation bypass.
- `minimatch@>=7` uses `11.0.1`, the first patched release for globparts amplification.
- Older glob 7 and minimatch 3 consumers retain their existing dependency versions;
  these advisory ranges do not include them.

Remove the overrides when Jest and nodemon require patched versions themselves.
Run the full backend suite after changing them because they cross dependency
major versions. No database migration or production configuration change is needed.

### Remaining upstream advisory

Dependabot alert #220 concerns `deepmerge@4.3.1`, used only by `jest-config` in
development. It is absent from the production dependency tree. As of November 12,
2026, npm has no patched deepmerge release and the latest Jest still depends on it.

The [upstream discussion](https://github.com/TehShrike/deepmerge/issues/273)
reports that the issuing CNA rejected CVE-2026-93753 after a dispute. However,
[GitHub's advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) still flags
the installed version. Keep the alert visible pending an advisory withdrawal or
an upstream release. Do not downgrade Jest or deepmerge merely to escape the
reported version range. The remaining low-severity audit entries for Jest are
transitive reports of this same deepmerge advisory.
