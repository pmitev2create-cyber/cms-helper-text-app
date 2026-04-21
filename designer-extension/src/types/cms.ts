export type CmsField = {
	id: string;
	displayName: string;
	slug: string;
	type: string;
	isRequired: boolean;
	helpText: string;
	isEditable?: boolean;
};

export type CmsCollection = {
	id: string;
	displayName: string;
	slug: string;
	fields: CmsField[];
};