const { utils } = require('@serverless/core');
const {
  pick,
  isMatch,
} = require('lodash');

const getDomain = async ({ elastic, name }) => {
  try {
    const res = await elastic
      .describeElasticsearchDomain({ DomainName: name })
      .promise();

    const { DomainStatus: domainStatus } = res;
    const { ElasticsearchClusterConfig, SnapshotOptions, EBSOptions } = domainStatus;

    return {
      id: domainStatus.DomainId,
      arn: domainStatus.ARN,
      name: domainStatus.DomainName,
      endpoint: domainStatus.Endpoint,
      processing: domainStatus.Processing || domainStatus.UpgradeProcessing,
      elasticsearchVersion: domainStatus.ElasticsearchVersion,
      elasticsearchClusterConfig: ElasticsearchClusterConfig,
      accessPolicies: JSON.parse(domainStatus.AccessPolicies),
      ebsOptions: EBSOptions,
      snapshotOptions: SnapshotOptions,
    };
  } catch (e) {
    if (e.code === 'ResourceNotFoundException') {
      return null;
    }
    throw e;
  }
};

const isDomainActive = domain => !domain.processing && domain.endpoint;

const waitForActive = async ({ elastic, name }) => {
  const timeout = 15 * 60 * 1000;
  const startTime = Date.now();
  let domain;
  let time;
  do {
    /* eslint no-await-in-loop: "off" */
    domain = await getDomain({ elastic, name });
    if (!domain) {
      return false;
    }

    if (isDomainActive(domain)) {
      return domain;
    }
    await utils.sleep(15000);
    time = Date.now() - startTime;
  } while (!isDomainActive(domain) && time < timeout);
  throw new Error('Timeout');
};

const createDomain = async ({
  elastic,
  name,
  elasticsearchVersion,
  accessPolicies,
  elasticsearchClusterConfig,
  ebsOptions,
  snapshotOptions,
}) => {
  const config = {
    DomainName: name,
    ElasticsearchVersion: elasticsearchVersion,
    AccessPolicies: accessPolicies ? JSON.stringify(accessPolicies) : undefined,
    ElasticsearchClusterConfig: elasticsearchClusterConfig,
    EBSOptions: ebsOptions,
    SnapshotOptions: snapshotOptions,
  };

  await elastic.createElasticsearchDomain(config).promise();
  return waitForActive({ elastic, name });
};

const updateDomain = async ({
  elastic,
  name,
  accessPolicies,
  elasticsearchClusterConfig,
  ebsOptions,
  snapshotOptions,
}) => {
  // FIXME: ElasticsearchVersion is not supported by updateElasticsearchDomainConfig
  const config = {
    DomainName: name,
    AccessPolicies: accessPolicies ? JSON.stringify(accessPolicies) : undefined,
    ElasticsearchClusterConfig: elasticsearchClusterConfig,
    EBSOptions: ebsOptions,
    SnapshotOptions: snapshotOptions,
  };
  await elastic.updateElasticsearchDomainConfig(config).promise();

  return waitForActive({ elastic, name });
};

const deleteDomain = async ({ elastic, name }) => {
  await elastic.deleteElasticsearchDomain({ DomainName: name }).promise();
};

const configChanged = (prevDomain, domain) => {
  const keys = [
    'name',
    'accessPolicies',
    'ebsOptions',
    'elasticsearchClusterConfig',
    'snapshotOptions',
  ];
  const inputs = pick(domain, keys);
  const prevInputs = pick(prevDomain, keys);

  return !isMatch(prevInputs, inputs);
};

module.exports = {
  getDomain,
  createDomain,
  updateDomain,
  configChanged,
  deleteDomain,
  waitForActive,
};
