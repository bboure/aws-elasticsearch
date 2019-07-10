# awsElasticSearch

Deploy an AWS ElasticSearch domain using [Serverless Component](https://github.com/serverless/components)

&nbsp;

1. [Install](#1-install)
2. [Create](#2-create)
3. [Configure](#3-configure)
4. [Deploy](#4-deploy)

&nbsp;

### 1. Install

```console
$ npm install -g @serverless/components
```

### 2. Create

```console
$ touch serverless.yml .env .env.prod
```

The directory should look something like this:

```
|- serverless.yml
|- .env         # your development AWS api keys
|- .env.prod    # your production AWS api keys
```

the `.env` files are not required if you have the aws keys set globally and you want to use a single stage, but they should look like this.

```
AWS_ACCESS_KEY_ID=XXX
AWS_SECRET_ACCESS_KEY=XXX
```

### 3. Configure

```yml
# serverless.yml

name: my-component
stage: dev

elasticSearch:
  component: "bboure/aws-elasticsearch"
  inputs:
    name: my-es-domain
    elasticsearchVersion: '6.7'
    elasticsearchClusterConfig:
      InstanceCount: 1
      InstanceType: t2.small.elasticsearch
    ebsOptions:
      EBSEnabled: true
      VolumeSize: 20
      VolumeType: 'gp2'
    accessPolicies:
      Version: "2012-10-17"
      Statement:
        - Effect: Allow
          Principal:
            AWS: "*"
          Action: es:*
          Resource: "*"
```

### 4. Deploy

```console
  $ components

  awsElasticsearch › outputs:
  arn:  'arn:aws:es:eu-west-1:123456789123:domain/sls-es-demo2'
  name:  'sls-es-demo'
  endpoint:  'search-sls-es-demo-225yp5riq4z3uhc7d4p2mn2ntu.eu-west-1.es.amazonaws.com'

  569s › dev › sls-es-demo › done
```

Note: Deployment can take several minutes as it waits for the domain to be completely created.

&nbsp;

### New to Components?

Checkout the [Serverless Components](https://github.com/serverless/components) repo for more information.
