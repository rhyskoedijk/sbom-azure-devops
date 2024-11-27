export interface ICreationInfo {
  created: string;
  creators: string[];
}

export function getCreatorOrganization(creationInfo: ICreationInfo): string | undefined {
  return creationInfo?.creators?.map((c) => c.match(/^Organization\:(.*)$/i)?.[1]?.trim()).filter((c) => c)?.[0];
}

export function getCreatorTool(creationInfo: ICreationInfo): string | undefined {
  return creationInfo?.creators?.map((c) => c.match(/^Tool\:(.*)$/i)?.[1]?.trim()).filter((c) => c)?.[0] || '';
}
