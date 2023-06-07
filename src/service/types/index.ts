export interface IValidatorInfo {
    publicKey: string;
    index: number;
    balance: number;
    withdrawal: number;
}

export interface IValidatorStatus {
    publicKey: string;
    status: number;
}

export interface IValidatorWithdrawal {
    index: number;
    withdrawal: number;
}
