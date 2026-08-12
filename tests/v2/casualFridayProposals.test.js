const request = require('supertest');
const { loadEnvironment } = require('../../src/v2/config/environment');
const { createApp } = require('../../src/v2/app');
const User = require('../../src/v2/models/User');
const Game = require('../../src/v2/models/CanonicalGame');
const Proposal = require('../../src/v2/models/CasualFridayGameProposal');
const Rotation = require('../../src/v2/models/CasualFridayRotationGame');

const config = loadEnvironment({
  NODE_ENV: 'test',
  MONGO_URI: 'mongodb://127.0.0.1:27017/gsplay_test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32)
});
const itadClient = {
  lookupTitle: jest.fn().mockResolvedValue({ outcome: 'not_found' }),
  bestOffers: jest.fn().mockResolvedValue(new Map())
};
const app = createApp(config, { itadClient });
const password = 'correct-horse-battery-staple';

async function account(username, role = 'member') {
  const member = await User.create({
    usernameNormalized: username.toLowerCase(),
    usernameDisplay: username,
    role,
    passwordHash: await User.hashPassword(password)
  });
  const agent = request.agent(app);
  await agent.post('/api/v2/auth/login').send({ username, password }).expect(200);
  return { agent, member };
}

const rotationPayload = (canonicalGameId) => ({
  canonicalGameId,
  displayTitle: 'Proposed Party',
  info: 'Join the lobby.',
  playerCountMin: 2,
  playerCountMax: 8,
  playerCountLabel: '',
  joinInstructions: '',
  hostMode: 'none',
  acquisitionKind: 'owned_store',
  acquisitionUrl: '',
  availabilityNote: ''
});

describe('Casual Friday game proposals', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await global.testUtils.cleanupDatabase();
  });

  test('accumulates unique member interest and exposes identities only in tools', async () => {
    const game = await Game.create({
      canonicalTitle: 'Proposed Party',
      normalizedTitle: 'proposed party'
    });
    const first = await account('FirstMember');
    const second = await account('SecondMember');
    const helper = await account('ProposalHelper', 'helper');

    await first.agent
      .post(`/api/v2/casual-friday/proposals/${game._id}`)
      .send({ unexpected: true })
      .expect(400);
    await first.agent.post(`/api/v2/casual-friday/proposals/${game._id}`).send({}).expect(200);
    await first.agent.post(`/api/v2/casual-friday/proposals/${game._id}`).send({}).expect(200);
    const secondResponse = await second.agent
      .post(`/api/v2/casual-friday/proposals/${game._id}`)
      .send({})
      .expect(200);
    expect(secondResponse.body.proposal).toEqual({
      status: 'pending',
      proposerCount: 2,
      proposedByMe: true,
      inRotation: false
    });

    const memberStatus = await first.agent
      .get(`/api/v2/casual-friday/proposals/${game._id}`)
      .expect(200);
    expect(memberStatus.body.proposal).not.toHaveProperty('proposers');
    const tools = await helper.agent.get('/api/v2/casual-friday/tools/proposals').expect(200);
    expect(tools.body.proposals).toHaveLength(1);
    expect(tools.body.proposals[0]).toMatchObject({
      proposerCount: 2,
      proposers: expect.arrayContaining([
        { id: String(first.member._id), username: 'FirstMember' },
        { id: String(second.member._id), username: 'SecondMember' }
      ]),
      game: { id: String(game._id), title: 'Proposed Party' }
    });
  });

  test('lets helpers accept through rotation creation and prevents new proposals while active', async () => {
    const game = await Game.create({
      canonicalTitle: 'Proposed Party',
      normalizedTitle: 'proposed party'
    });
    const member = await account('InterestedMember');
    const helper = await account('AcceptingHelper', 'helper');
    await member.agent.post(`/api/v2/casual-friday/proposals/${game._id}`).send({}).expect(200);

    const accepted = await helper.agent
      .post('/api/v2/casual-friday/tools/rotation/from-catalogue')
      .send(rotationPayload(String(game._id)))
      .expect(201);
    const proposal = await Proposal.findOne({ canonicalGameId: game._id });
    expect(proposal).toMatchObject({
      status: 'approved',
      reviewedBy: helper.member._id,
      rotationGameId: expect.anything()
    });
    expect(String(proposal.rotationGameId)).toBe(accepted.body.rotation.id);
    expect(await Rotation.countDocuments({ canonicalGameId: game._id, status: 'active' })).toBe(1);
    await helper.agent.get('/api/v2/casual-friday/tools/proposals').expect(200, { proposals: [] });
    await member.agent.post(`/api/v2/casual-friday/proposals/${game._id}`).send({}).expect(409);
    const status = await member.agent
      .get(`/api/v2/casual-friday/proposals/${game._id}`)
      .expect(200);
    expect(status.body.proposal).toMatchObject({ status: 'approved', inRotation: true });
  });

  test('keeps rejection admin-only and reopens cumulative interest later', async () => {
    const game = await Game.create({
      canonicalTitle: 'Second Chance',
      normalizedTitle: 'second chance'
    });
    const first = await account('OriginalFan');
    const second = await account('NewFan');
    const helper = await account('CannotReject', 'helper');
    const admin = await account('ProposalAdmin', 'admin');
    await first.agent.post(`/api/v2/casual-friday/proposals/${game._id}`).send({}).expect(200);
    const proposal = await Proposal.findOne({ canonicalGameId: game._id });
    await helper.agent
      .post(`/api/v2/casual-friday/tools/proposals/${proposal._id}/reject`)
      .send({ adminNote: 'No' })
      .expect(403);
    await admin.agent
      .post(`/api/v2/casual-friday/tools/proposals/${proposal._id}/reject`)
      .send({ adminNote: 'Needs another look' })
      .expect(204);
    expect(await Proposal.findById(proposal._id)).toMatchObject({
      status: 'rejected',
      adminNote: 'Needs another look',
      reviewedBy: admin.member._id
    });

    const reopenedByOriginal = await first.agent
      .post(`/api/v2/casual-friday/proposals/${game._id}`)
      .send({})
      .expect(200);
    expect(reopenedByOriginal.body.proposal).toMatchObject({
      status: 'pending',
      proposerCount: 1,
      proposedByMe: true
    });
    const reopened = await second.agent
      .post(`/api/v2/casual-friday/proposals/${game._id}`)
      .send({})
      .expect(200);
    expect(reopened.body.proposal).toMatchObject({ status: 'pending', proposerCount: 2 });
  });

  test('removes a deleted account without losing remaining proposal interest', async () => {
    const game = await Game.create({ canonicalTitle: 'Keep Me', normalizedTitle: 'keep me' });
    const first = await account('LeavingMember');
    const second = await account('StayingMember');
    const admin = await account('DeletingAdmin', 'admin');
    await first.agent.post(`/api/v2/casual-friday/proposals/${game._id}`).send({}).expect(200);
    await second.agent.post(`/api/v2/casual-friday/proposals/${game._id}`).send({}).expect(200);

    await admin.agent
      .delete(`/api/v2/admin/users/${first.member._id}`)
      .send({ confirmation: 'DELETE LeavingMember', reason: 'Left the group' })
      .expect(200);
    const proposal = await Proposal.findOne({ canonicalGameId: game._id });
    expect(proposal.proposedBy.map(String)).toEqual([String(second.member._id)]);
  });
});
