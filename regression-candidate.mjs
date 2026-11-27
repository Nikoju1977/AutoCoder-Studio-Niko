import {develop, prepareDeveloper} from './developer-runtime.mjs';
import {prepareSandbox} from './sandbox-runner.mjs';

export async function generateRegressionCandidate({mission, harness, image, language}, {approval, request} = {}) {
  const spec = {...mission, mode: 'regression'};
  const plan = prepareDeveloper(spec);
  // Validate the local scenario and language before any provider call.
  prepareSandbox({
    proposal: {format: 'code-mode-x-github-proposal-v1', status: 'review_required',
      repo: plan.manifest.repo, branch: plan.manifest.branch, commit: plan.manifest.commit,
      changes: plan.selected.map(({path, sha}) => ({path, expectedBlob: sha, content: ''}))},
    originals: plan.selected, harness, image, language
  });
  if (!approval) return {status: 'approval_required', manifest: plan.manifest, approvalDigest: plan.approvalDigest};

  const result = await develop({spec, approval, request});
  if (!result.proposal) return result;
  const changed = new Set(result.proposal.changes.map(file => file.path));
  const bundle = {
    proposal: result.proposal,
    originals: plan.selected.filter(file => changed.has(file.path)).map(({path, content}) => ({path, content})),
    harness, image, language
  };
  const validation = prepareSandbox(bundle);
  return {status: result.status, providerCalls: result.providerCalls, bundle,
    ...(result.ideas ? {ideas: result.ideas} : {}), validationDigest: validation.approvalDigest, testsExecuted: false};
}
