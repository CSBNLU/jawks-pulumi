import { API } from "..";
import * as aws from "@pulumi/aws";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { JWK } from "jose";
import { z } from "zod";

type JWKSet = {
  keys: JWK[];
};

export interface Dependencies {}

export interface Props {
  region: string;
  table: aws.dynamodb.Table;
}

export const create =
  (deps: Dependencies) =>
  (props: Props): API.JWKSRepository => {
    const { region, table } = props;

    return {
      list: async (): Promise<JWKSet> => {
        const dynamodb = new DynamoDBClient({ region });
        const documentClient = DynamoDBDocumentClient.from(dynamodb);

        const jwkSchema = z.object({
          kty: z.literal("EC"),
          crv: z.literal("P-521"),
          x: z.string(),
          y: z.string(),
          d: z.string().optional(),
          use: z.literal("sig"),
          alg: z.literal("ES512"),
          kid: z.string(),
        });

        const tableName = table.name.get();

        try {
          // 1. Retrieve the existing JWKS from the DynamoDB table
          const data = await documentClient.send(
            new ScanCommand({
              TableName: tableName,
              FilterExpression: "#expires_at > :now",
              ExpressionAttributeNames: {
                "#expires_at": "expires_at",
              },
              ExpressionAttributeValues: {
                ":now": Date.now().toString(),
              },
            }),
          );

          // 2. Check if there are any items in the table
          if (data.Items) {
            // 3. Parse the items
            const jwks = data.Items.map((item) => jwkSchema.parse(item));
            // 4. Return the JWKS
            return { keys: jwks };
          } else {
            return { keys: [] };
          }
        } catch (err) {
          if (
            err instanceof Error &&
            err.name !== "ResourceNotFoundException"
          ) {
            throw err;
          } else {
            return { keys: [] };
          }
        }
      },
    };
  };
