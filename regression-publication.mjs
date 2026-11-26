import {prepareSandbox, runSandbox} from './sandbox-runner.mjs';
import {publishDraft} from './code-mode-x-publish.mjs';

export async function validateAndPublish(spec, {approval, request, spawn} = {}) {
  const plan = prepareSandbox(spec);
  if (!approval) {
    return {status: 'approval_required', approvalDigest: plan.approvalDigest, manifest: plan.manifest};
  }
  const evidence = runSandbox({spec, approval, spawn});
  if (evidence.status !== 'fixture_improved') {
    return {status: 'publication_blocked', evidence};
  }
  const publication = await publishDraft(spec.proposal, {
    request, approval: evidence.manifest.proposalDigest, regressionEvidence: evidence
  });
  return {...publication, evidence};
}
