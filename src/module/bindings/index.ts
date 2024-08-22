import { API } from "..";
import * as aws from "@pulumi/aws";
import * as Implementation from "../implementation";

interface Dependencies {
  jwksTable: aws.dynamodb.Table;
  region: string;
  s3Bucket: aws.s3.BucketV2;
}

/**
 * @param props.jwksFileKey The key of the JWKS file in the S3 bucket
 */
interface Props {
  jwksFileKey: string;
}

export const create =
  (deps: Dependencies) =>
  (props: Props): API.JWKSModule => {
    const { jwksTable, region, s3Bucket } = deps;
    const { jwksFileKey } = props;

    const jwksRepository = Implementation.jwksRepository.create({})({
      region,
      table: jwksTable,
    });

    const keySetRotationProcessor =
      Implementation.keySetRotationProcessor.create({
        jwksRepository,
        s3Bucket,
      })({ jwksFileKey });

    return {
      keySetRotationProcessor,
    };
  };
