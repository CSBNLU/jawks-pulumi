import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Region } from ".";

export interface TableProps {
  prefix: string;
  replicas: Region[];
}

export const jwksTable = (
  props: TableProps,
): { table: aws.dynamodb.Table; policy: aws.iam.Policy } => {
  const { prefix, replicas } = props;
  const table = new aws.dynamodb.Table(`${prefix}-jwks`, {
    attributes: [{ name: "pk", type: "S" }],
    hashKey: "pk",
    billingMode: "PAY_PER_REQUEST",

    // Enabled point in time recovery
    pointInTimeRecovery: { enabled: true },

    ttl: { attributeName: "delete_at", enabled: true },

    streamEnabled: true,
    streamViewType: "KEYS_ONLY",

    // Specify the replicas for the global table
    replicas: replicas.map((region) => ({ regionName: region })),
  });

  const policy = new aws.iam.Policy(`${prefix}-dynamoPolicy`, {
    description: "IAM policy for DynamoDB read/write access",
    policy: pulumi.output({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:Scan",
            "dynamodb:Query",
            "dynamodb:BatchGetItem",
            "dynamodb:BatchWriteItem",
          ],
          Resource: table.arn,
        },
      ],
    }),
  });

  return { table, policy };
};
