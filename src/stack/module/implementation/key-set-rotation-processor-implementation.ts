import { API } from "..";
import * as aws from "@pulumi/aws";
import { S3 } from "@aws-sdk/client-s3";

export interface Dependencies {
  jwksRepository: API.JWKSRepository;
  s3Bucket: aws.s3.BucketV2;
}

export interface Props {
  jwksFileKey: string;
}

export const create =
  (deps: Dependencies) =>
  (props: Props): API.KeySetRotationProcessor => {
    const { jwksRepository, s3Bucket } = deps;
    const { jwksFileKey } = props;

    return {
      execute: async () => {
        const s3Client = new S3();

        const latestKeySet = await jwksRepository.list();

        await s3Client.putObject({
          Bucket: s3Bucket.bucket.get(),
          Key: jwksFileKey,
          Body: JSON.stringify(latestKeySet),
          ContentType: "application/json",
        });
      },
    };
  };
