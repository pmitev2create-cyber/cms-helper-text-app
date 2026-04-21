/**
 * External dependencies.
 */
import { useMemo } from "react";
import {
	Box,
	Button,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from "@mui/material";

/**
 * Internal dependencies.
 */
import type { CmsField, GeneratedFieldHelpText } from "../services/api";

type CollectionFieldsTableProps = {
	title: string;
	collectionId: string;
	slug: string;
	fields: CmsField[];
	generatedFields: GeneratedFieldHelpText[];
	isApplying?: boolean;
	isApplyingAll?: boolean;
	onSuggestedTextChange: (fieldId: string, value: string) => void;
	onApplyRow: (fieldId: string) => void;
	onApplyAll: () => void;
};

export function CollectionFieldsTable({
	title,
	collectionId,
	slug,
	fields,
	generatedFields,
	isApplying = false,
	isApplyingAll = false,
	onSuggestedTextChange,
	onApplyRow,
	onApplyAll,
}: CollectionFieldsTableProps) {
	const generatedMap = useMemo(() => {
		return generatedFields.reduce<Record<string, GeneratedFieldHelpText>>((acc, field) => {
			acc[field.fieldId] = field;
			return acc;
		}, {});
	}, [generatedFields]);

	const hasGeneratedFields = generatedFields.length > 0;

	const hasAppiableGeneratedFields = fields.some((field) => {
		const hasExistingHelpText = Boolean(field.helpText?.trim());
		const generated = generatedMap[field.id];

		return !hasExistingHelpText && Boolean(generated?.suggestedHelpText?.trim());
	});

	if (!fields.length) {
		return (
			<Box sx={{ mt: 2 }}>
				<Typography variant="body1">No fields found.</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ mt: 2 }}>
			{/* {hasGeneratedFields ? (
				
			) : null} */}

			<TableContainer 
				className="table-cms"
				sx={{
					maxHeight: 315,
				}}
			>
				<Table stickyHeader>
					<TableHead>
						<TableRow>
							<TableCell>Field</TableCell>

							<TableCell>Type</TableCell>
							
							<TableCell>Current Help Text</TableCell>
							
							{hasGeneratedFields ? <TableCell>Suggested Help Text</TableCell> : null}
							
							{hasGeneratedFields ? 
								<TableCell sx={{whiteSpace: "nowrap"}}>
									<Button
										variant="contained"
										onClick={onApplyAll}
										disabled={isApplyingAll || !hasAppiableGeneratedFields}
									>
										{isApplyingAll ? "Applying All..." : "Apply All"}
									</Button>
								</TableCell> 
							: null}
						</TableRow>
					</TableHead>

					<TableBody>
						{fields.map((field) => {
							const generated = generatedMap[field.id];
							const hasExistingHelpText = Boolean(field.helpText?.trim());
							const canEditSuggestedText = !hasExistingHelpText && Boolean(generated);

							return (
								<TableRow key={field.id}>
									<TableCell>{field.displayName}</TableCell>

									<TableCell>{field.type}</TableCell>
									
									<TableCell>{field.helpText || "—"}</TableCell>

									{hasGeneratedFields ? (
										<TableCell sx={{ minWidth: 320 }}>
											{canEditSuggestedText ? (
												<TextField
													fullWidth
													size="small"
													multiline
													minRows={2}
													value={generated?.suggestedHelpText || ""}
													onChange={(event) =>
														onSuggestedTextChange(field.id, event.target.value)
													}
												/>
											) : (
												<Typography variant="body2" sx={{ opacity: 0.5 }}>
													{hasExistingHelpText ? "Already has help text" : "—"}
												</Typography>
											)}
										</TableCell>
									) : null}

									{hasGeneratedFields ? (
										<TableCell align="right">
											{canEditSuggestedText ? (
												<Button
													variant="outlined"
													size="small"
													onClick={() => onApplyRow(field.id)}
													disabled={isApplying || !generated?.suggestedHelpText?.trim()}
												>
													Apply
												</Button>
											) : (
												<Typography variant="body2" sx={{ opacity: 0.5 }}>
													—
												</Typography>
											)}
										</TableCell>
									) : null}
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}