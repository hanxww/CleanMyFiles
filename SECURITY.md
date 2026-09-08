# Security

CleanMyFiles works with local filesystem paths, so security issues can have a direct impact on user data.

Please do not publish a proof-of-concept for a destructive filesystem bug before a fix is available. Open a private security report through GitHub Security Advisories when the repository is hosted on GitHub.

Particularly important reports include:

- deletion affecting paths the user did not select;
- symlink or path traversal issues;
- unexpected network transmission of filesystem metadata or contents;
- unsafe archive handling added in future versions;
- command injection or shell invocation vulnerabilities.

The current application does not require a backend service and is designed to process scan data locally.
