export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  VoucherDetails: { voucherId: string };
  VoucherForm: { voucherId?: string } | undefined;
  Settings: undefined;
};