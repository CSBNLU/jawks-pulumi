import * as aws from "@pulumi/aws";
import * as InfrastructureAdapters from "../infrastructure-adapters";
import { Region } from ".";

export interface Props {
  prefix: string;
  recoveryWindowInDays: number;
  replicas: Region[];
}

export const create = (
  props: Props,
): InfrastructureAdapters.PrivateKeyStore => {
  const { prefix, recoveryWindowInDays, replicas } = props;

  return {
    provisionSecret: (props): aws.secretsmanager.Secret => {
      const { name, description } = props;

      const secret = new aws.secretsmanager.Secret(`${prefix}-${name}`, {
        name: `${prefix}-${name}`,
        description,
        forceOverwriteReplicaSecret: true,
        recoveryWindowInDays: recoveryWindowInDays,
        replicas: replicas.map((region) => ({ region })),
      });

      return secret;
    },
  };
};
