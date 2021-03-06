const { Component } = require('@serverless/core');
const { ES } = require('aws-sdk');
const { defaultsDeep } = require('lodash');
const {
  pick,
  reduce,
  values,
  every,
} = require('lodash');
const {
  getDomain,
  waitForActive,
  createDomain,
  configChanged,
  updateDomain,
  deleteDomain,
} = require('./utils');

const defaults = {
  region: 'us-east-1',
  name: 'elasticsearch',
  elasticsearchVersion: '6.7',
  accessPolicies: null,
  ebsOptions: {
    EBSEnabled: true,
    VolumeSize: 10,
    VolumeType: 'gp2',
  },
  elasticsearchClusterConfig: {
    InstanceCount: 1,
    InstanceType: 't2.small.elasticsearch',
  },
  snapshotOptions: {
    AutomatedSnapshotStartHour: 0,
  },
};

// Fix arrays.
// Issue https://github.com/serverless/template/issues/1
const fixArrays = object => reduce(
  object,
  (acc, val, key) => {
    if (typeof val === 'object') {
      let newVal = fixArrays(val);
      if (every(Object.keys(newVal), v => !Number.isNaN(parseInt(v, 10)))) {
        newVal = values(newVal);
      }

      acc[key] = newVal;
    } else {
      acc[key] = val;
    }

    return acc;
  },
  {},
);


class AwsElasticsearch extends Component {
  async default(inputs = {}) {
    this.context.status('Deploying');
    const config = fixArrays(defaultsDeep(inputs, defaults));

    const elastic = new ES({
      region: config.region,
      credentials: this.context.credentials.aws,
    });

    let prevDomain = await getDomain({ elastic, ...config });

    if (prevDomain && prevDomain.processing) {
      this.context.debug('Domain in processing status.');
      this.context.status('Waiting for domain to be active.');
      prevDomain = await waitForActive({ elastic, ...config });
    }

    if (!prevDomain) {
      this.context.status('Creating');
      const { arn, endpoint } = await createDomain({ elastic, ...config });
      config.arn = arn;
      config.endpoint = endpoint;
    } else {
      config.arn = prevDomain.arn;
      config.endpoint = prevDomain.endpoint;
      if (configChanged(prevDomain, config)) {
        this.context.status('Updating');
        await updateDomain({ elastic, ...config });
      } else {
        this.context.debug('Config did not change');
      }
    }

    const outputs = pick(config, ['name', 'arn', 'endpoint', 'region']);
    this.state = outputs;
    await this.save();

    // Return your outputs
    return outputs;
  }

  async remove() {
    this.context.status('Removing');

    const config = defaultsDeep({}, this.state, defaults);

    const elastic = new ES({
      region: config.region,
      credentials: this.context.credentials.aws,
    });
    const domain = await getDomain({ elastic, ...config });

    if (domain) {
      this.context.debug(`Removing ${domain.name} (${domain.arn})`);
      await deleteDomain({ elastic, ...config });
    } else {
      this.context.debug(`${config.name} domain not found in region ${config.region}`);
    }

    this.state = {};
    await this.save();

    return {};
  }
}

module.exports = AwsElasticsearch;
