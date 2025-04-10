# ZTMF Scoring

The ZTMF Scoring Application allows ADOs to view their Zero Trust Maturity score online. An upcoming release will allow new ADOs to answer the questionnaire from scratch, and existing ADOs to update their answers, all within a web-based interface. The interface and the API are protected by AWS Verified Access which requires authentication via IDM (Okta).

This monorepo contains the following major components:
- `.src/components/` contains reusable components shared within views
- `.src/views/` contains all pages and dialogs that are used throughout the application
- `.github/workflows/` contains workflows for Github Actions to test, build, and deploy to AWS

## Architecture

This project contains the application's UI built with React, Vite, TypeScript, and SWC. It requires Node.js v20, [nvm](https://github.com/nvm-sh/nvm) (or [n](https://github.com/tj/n)), and Yarn v4.

## System Requirements

- [Node 20](https://nodejs.org/en/download)
- [Yarn](https://yarnpkg.com/getting-started/install)
- [GitLeaks](https://github.com/gitleaks/gitleaks/tree/master#installing)


## CI/CD Workflows

The project uses GitHub Actions for continuous integration and deployment. The workflows are organized into modular components that are orchestrated differently for development and production environments.

### Workflow Components

1. **Analysis (`analysis.yml`)**
   - Performs code quality and security checks
   - Lints Go code using staticcheck
   - Lints Terraform code using tflint
   - Runs Snyk security scans for Go code, source code, and infrastructure as code

2. **ui (`ui.yml`)**
   - DEBUG - node, npm, yarn versions
   - Get the cache dependencies. Install new dependencies if the last build is different than the latest build
   - Install dependencies
   - Perform linting 
   - Get AWS creds
   - Sync build to to AWS S3


### Orchestration

The workflows are orchestrated differently based on the environment:

**Development Environment (`orchestration-dev.yml`)**
- Triggered on pull requests to the main branch
- Runs analysis on all PRs
- For non-draft PRs, checks for changes in the backend code
- If backend changes are detected, runs the backend workflow for DEV
- Finally runs the infrastructure workflow for DEV

**Production Environment (`orchestration-prod.yml`)**
- Triggered when a pull request to main is merged (closed with merge)
- Runs analysis, backend, and infrastructure workflows sequentially for PROD
- Only executes if the PR was actually merged

## Getting Started

1. Clone the repository and `cd` into the root directory:

```shell
git clone git@github.com:CMS-Enterprise/ztmf-ui.git`

cd ztmf-ui
```

2. Setup Node.js and Yarn

```shell
# using nvm
nvm install --latest-npm
nvm use

# using n
n install auto
n use auto

# enable corepack
corepack enable yarn
```

3. Install dependencies:

```shell
yarn
```

3. Install pre-commit hooks:

```shell
yarn prepare
```

## Building

To build the application, run the following from the root directory:

```shell
yarn build
```

## Testing

To run all tests, run the following from the root directory:

```shell
yarn test
```

To lint all files, run the following from the root directory:

```shell
yarn lint
```

## Developing

First, run the post-install script to create the local development environment file from the example environment file.

```shell
sh ./scripts/post-install.sh
```

To start the local development server, run the following from the root directory:

```shell
yarn dev
```

## Backend

ZTMF (backend) has its own [repository](https://github.com/cms-enterprise/ztmf).
