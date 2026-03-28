export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  VoucherCreateEntry: undefined;
  VoucherDetails: { voucherId: string };
  VoucherForm:
    | {
        voucherId?: string;
        createMode?: 'manual' | 'upload';
        initialVoucherType?: 'monetary' | 'product';
        autoPickAttachment?: boolean;
      }
    | undefined;
  Settings: undefined;
};
