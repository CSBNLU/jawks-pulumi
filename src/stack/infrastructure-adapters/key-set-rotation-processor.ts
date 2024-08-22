import * as aws from "@pulumi/aws";
import { JWKS } from "..";
import * as pulumi from "@pulumi/pulumi";

export interface Dependencies {
  jwksModule: JWKS.API.JWKSModule;
  s3Bucket: aws.s3.BucketV2;
  table: {
    table: aws.dynamodb.Table;
    policy: aws.iam.Policy;
  };
}

export interface Props {
  jwksFileKey: string;
  prefix: string;
}

export const create = (deps: Dependencies) => (props: Props) => {
  const { jwksModule, s3Bucket, table } = deps;
  const { jwksFileKey, prefix } = props;

  // Step 2: Create the Lambda Function
  const lambdaRole = new aws.iam.Role(
    `${prefix}-jwksKeySetRotationProcessorLambda`,
    {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "lambda.amazonaws.com",
      }),
    },
  );

  const streamPolicy = new aws.iam.RolePolicy(
    `${prefix}-jwksKeySetRotationProcessorLambdaStreamPolicy`,
    {
      role: lambdaRole.id,
      policy: pulumi.output({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "dynamodb:ListStreams",
              "dynamodb:DescribeStream",
              "dynamodb:GetRecords",
              "dynamodb:GetShardIterator",
            ],
            Resource: table.table.streamArn,
          },
          {
            Effect: "Allow",
            Action: [
              "dynamodb:ListStreams",
              "dynamodb:DescribeStream",
              "dynamodb:GetRecords",
              "dynamodb:GetShardIterator",
            ],
            Resource: table.table.streamArn,
          },
          {
            Action: "logs:*",
            Effect: "Allow",
            Resource: "arn:aws:logs:*:*:*",
          },
        ],
      }),
    },
    {
      dependsOn: [table.table, table.policy],
    },
  );

  const dynamoDBPolicy = new aws.iam.RolePolicy(
    `${prefix}-jwksKeySetRotationProcessorLambdaDynamoDBPolicy`,
    {
      role: lambdaRole.id,
      policy: pulumi.output({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "dynamodb:GetItem",
              "dynamodb:BatchGetItem",
              "dynamodb:Scan",
              "dynamodb:Query",
              "dynamodb:ConditionCheckItem",
            ],
            Resource: table.table.arn,
          },
        ],
      }),
    },
    {
      dependsOn: [table.table, table.policy],
    },
  );

  const s3Policy = new aws.iam.RolePolicy(
    `${prefix}-jwksKeySetRotationProcessorLambdaS3Policy`,
    {
      role: lambdaRole.id,
      policy: s3Bucket.bucket.apply((bucketName) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "s3:ListBucket",
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:PutObjectVersionAcl",
              ],
              Resource: `arn:aws:s3:::${bucketName}/${jwksFileKey}`,
            },
          ],
        }),
      ),
    },
    {
      dependsOn: [table.table, table.policy],
    },
  );

  const dynamoDBPolicyAttachment = new aws.iam.RolePolicyAttachment(
    `${prefix}-lambdaPolicyAttachment`,
    {
      role: lambdaRole.name, // Use the Lambda function's role
      policyArn: table.policy.arn, // The ARN of the policy to attach
    },
    {
      dependsOn: [table.table, table.policy, lambdaRole, streamPolicy],
    },
  );

  const lambda = new aws.lambda.CallbackFunction(
    `${prefix}-jwks-key-set-rotation-processor`,
    {
      architectures: ["arm64"],
      callback: async () => {
        await jwksModule.keySetRotationProcessor.execute();
      },
      role: lambdaRole.arn,
    },
  );

  // Step 3: Create an Event Source Mapping
  const eventSourceMapping = new aws.lambda.EventSourceMapping(
    `${prefix}-eventSourceMapping`,
    {
      eventSourceArn: table.table.streamArn,
      functionName: lambda.arn,
      startingPosition: "TRIM_HORIZON", // To avoid missing any events
    },
    {
      dependsOn: [table.table, table.policy, dynamoDBPolicyAttachment],
    },
  );

  // Step 4: Manage Permissions
  const lambdaInvokePermission = new aws.lambda.Permission(
    `${prefix}-lambdaInvokePermission`,
    {
      action: "lambda:InvokeFunction",
      function: lambda.name,
      principal: "dynamodb.amazonaws.com",
      sourceArn: table.table.streamArn,
    },
    {
      dependsOn: [table.table, table.policy],
    },
  );

  return lambda;
};
