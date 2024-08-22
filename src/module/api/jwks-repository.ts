import { JWK } from "jose";

export type JWKSet = {
  keys: JWK[];
};

export interface JWKSRepository {
  list: () => Promise<JWKSet>;
}
