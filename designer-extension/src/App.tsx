import { useEffect, useRef, useState } from "react";
import {
	ThemeProvider,
	Box,
	Button,
	MenuItem,
	Select,
	Typography,
	CircularProgress,
	FormControl,
	InputLabel,
} from "@mui/material";

import { AuthScreen } from "./components/AuthScreen";
import { useAuth } from "./hooks/useAuth";
import { CollectionFieldsTable } from "./components/CollectionFieldsTable";
import { theme } from "./components/theme";
import {
	getCollections,
	getCollection,
	generateHelpText,
	applyHelpText,
	type CollectionListItem,
	type CmsCollection,
	type GeneratedFieldHelpText,
} from "./services/api";
import "./App.css";

function AppContent() {
	const { sessionToken, exchangeAndVerifyIdToken } = useAuth();
	const hasCheckedToken = useRef(false);

	const [siteId, setSiteId] = useState("");
	const [siteName, setSiteName] = useState("");
	const [collections, setCollections] = useState<CollectionListItem[]>([]);
	const [selectedCollectionId, setSelectedCollectionId] = useState("");
	const [selectedCollection, setSelectedCollection] = useState<CmsCollection | null>(null);
	const [generatedFields, setGeneratedFields] = useState<GeneratedFieldHelpText[]>([]);
	const [loadingGenerate, setLoadingGenerate] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [isApplyingAll, setIsApplyingAll] = useState(false);
	const [showCollectionSelect, setShowCollectionSelect] = useState(false);

	const [loadingSite, setLoadingSite] = useState(true);
	const [loadingCollections, setLoadingCollections] = useState(false);
	const [loadingFields, setLoadingFields] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		webflow.setExtensionSize("large");

		if (!hasCheckedToken.current) {
			const storedUser = localStorage.getItem("wf_hybrid_user");
			const wasExplicitlyLoggedOut = localStorage.getItem("explicitly_logged_out");

			if (storedUser && !wasExplicitlyLoggedOut) {
				exchangeAndVerifyIdToken();
			}

			hasCheckedToken.current = true;
		}

		const handleAuthComplete = async (event: MessageEvent) => {
			if (event.data === "authComplete") {
				localStorage.removeItem("explicitly_logged_out");
				await exchangeAndVerifyIdToken();
			}
		};

		window.addEventListener("message", handleAuthComplete);

		return () => {
			window.removeEventListener("message", handleAuthComplete);
			hasCheckedToken.current = false;
		};
	}, [exchangeAndVerifyIdToken]);

	useEffect(() => {
		async function initSite() {
			if (!sessionToken) {
				setLoadingSite(false);
				return;
			}

			try {
				setError("");
				setLoadingSite(true);

				const siteInfo = await webflow.getSiteInfo();
				const currentSiteId = siteInfo?.siteId || siteInfo?.id || "";
				const currentSiteName = siteInfo?.siteName || siteInfo?.name || "";

				if (!currentSiteId) {
					throw new Error("Could not determine current Webflow site ID.");
				}

				if (!currentSiteName) {
					throw new Error("Could not determine current Webflow site name.");
				}

				setSiteId(currentSiteId);
				setSiteName(currentSiteName);
			} catch (err: unknown) {
				if (err instanceof Error) {
					setError(err.message || "Failed to load current site");
				} else {
					setError("Failed to load current site");
				}
			} finally {
				setLoadingSite(false);
			}
		}

		initSite();
	}, [sessionToken]);

	function handleSuggestedTextChange(fieldId: string, value: string) {
		setGeneratedFields((prev) =>
			prev.map((field) =>
				field.fieldId === fieldId
					? { ...field, suggestedHelpText: value }
					: field
			)
		);
	}

	async function handleApplyRow(fieldId: string) {
		if (!selectedCollectionId || !siteId) {
			return;
		}

		try {
			setError("");
			setIsApplying(true);

			const targetField = generatedFields.find((field) => field.fieldId === fieldId);

			if (!targetField) {
				throw new Error("Generated field not found.");
			}

			await applyHelpText(selectedCollectionId, siteId, [
				{
					fieldId: targetField.fieldId,
					helpText: targetField.suggestedHelpText,
				},
			]);

			setSelectedCollection((prev) => {
				if (!prev) {
					return prev;
				}

				return {
					...prev,
					fields: prev.fields.map((field) =>
						field.id === fieldId
							? { ...field, helpText: targetField.suggestedHelpText }
							: field
					),
				};
			});
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message || "Failed to apply help text");
			} else {
				setError("Failed to apply help text");
			}
		} finally {
			setIsApplying(false);
		}
	}

	async function handleApplyAll() {
		if (!selectedCollectionId || !siteId || !generatedFields.length) {
			return;
		}

		try {
			setError("");
			setIsApplyingAll(true);

			await applyHelpText(
				selectedCollectionId,
				siteId,
				generatedFields
					.filter((field) => field.suggestedHelpText.trim())
					.map((field) => ({
						fieldId: field.fieldId,
						helpText: field.suggestedHelpText,
					}))
			);

			setSelectedCollection((prev) => {
				if (!prev) {
					return prev;
				}

				return {
					...prev,
					fields: prev.fields.map((field) => {
						const generated = generatedFields.find(
							(item) => item.fieldId === field.id
						);

						if (!generated) {
							return field;
						}

						return {
							...field,
							helpText: generated.suggestedHelpText,
						};
					}),
				};
			});
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message || "Failed to apply all help text");
			} else {
				setError("Failed to apply all help text");
			}
		} finally {
			setIsApplyingAll(false);
		}
	}

	async function handleLoadCollections() {
		if (!siteId) {
			return;
		}

		try {
			setError("");
			setLoadingCollections(true);
			setShowCollectionSelect(true);
			setSelectedCollectionId("");
			setSelectedCollection(null);
			setGeneratedFields([]);

			const data = await getCollections(siteId);
			setCollections(data.collections || []);
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message || "Failed to load collections");
			} else {
				setError("Failed to load collections");
			}
		} finally {
			setLoadingCollections(false);
		}
	}

	async function handleCollectionChange(collectionId: string) {
		setSelectedCollectionId(collectionId);
		setSelectedCollection(null);
		setGeneratedFields([]);

		if (!collectionId) {
			return;
		}

		try {
			setError("");
			setLoadingFields(true);

			const data = await getCollection(collectionId, siteId);
			setSelectedCollection(data);
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message || "Failed to load collection details");
			} else {
				setError("Failed to load collection details");
			}
		} finally {
			setLoadingFields(false);
		}
	}

	async function handleGenerateHelpText() {
		if (!selectedCollectionId || !siteId) {
			setError("Missing selectedCollectionId or siteId");
			return;
		}

		try {
			setError("");
			setLoadingGenerate(true);

			const data = await generateHelpText(selectedCollectionId, siteId);
			setGeneratedFields(data.fields || []);

			if (!data.fields?.length) {
				setError("No generated fields were returned.");
			}
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message || "Failed to generate help text");
			} else {
				setError("Failed to generate help text");
			}
		} finally {
			setLoadingGenerate(false);
		}
	}

	if (!sessionToken) {
		return <AuthScreen onAuth={() => {}} />;
	}

	return (
		<Box>
			<Typography variant="h3" sx={{ mb: 2 }}>
				CMS Helper Text Generator
			</Typography>

			{error ? (
				<Typography color="error" sx={{ mb: 2 }}>
					{error}
				</Typography>
			) : null}

			<Box sx={{ mb: 2.5 }}>
				<Typography variant="body1">
					Site Name: {loadingSite ? "Loading..." : siteName || "Not found"}
				</Typography>

				<Typography variant="body1">
					Site ID: {loadingSite ? "Loading..." : siteId || "Not found"}
				</Typography>
			</Box>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "repeat(2, 1fr)",
					gap: 2,
					mb: 2,
				}}
			>
				<Box
					sx={{
						display: "flex",
						gap: 2,
					}}
				>
					<Button
						variant="outlined"
						size="large"
						onClick={handleLoadCollections}
						disabled={!siteId || loadingSite || loadingCollections}
						sx={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 1.5,
							minWidth: 200,
						}}

					>
						{loadingCollections ? "Loading Collections..." : "Load Collections"}

						{loadingCollections && <CircularProgress size={16} />}
					</Button>
				</Box>

				<Box
					sx={{
						flex: "",
					}}
				>
					<FormControl
						fullWidth
						size="small"
						disabled={!collections.length || loadingCollections}
					>
						<InputLabel id="collection-select-label">Collection</InputLabel>
						<Select
							labelId="collection-select-label"
							value={selectedCollectionId}
							label="Collection"
							onChange={(event) => handleCollectionChange(event.target.value)}
						>
							<MenuItem value="">
								<em>Select a collection</em>
							</MenuItem>
							{collections.map((collection) => (
								<MenuItem key={collection.id} value={collection.id}>
									{collection.displayName}
								</MenuItem>
							))}
						</Select>
					</FormControl>
				</Box>
			</Box>

			{loadingFields ? (
				<Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 1 }}>
					<CircularProgress size={20} />

					<Typography variant="body2">Loading fields...</Typography>
				</Box>
			) : null}

			{selectedCollection ? (
				<Box sx={{  }}>
					<Box sx={{mb: 2, textAlign: "right" }}>
						<Button
							variant="outlined"
							size="large"
							onClick={handleGenerateHelpText}
							disabled={!selectedCollectionId || loadingGenerate}
						>
							{loadingGenerate ? "Generating..." : "Generate Help Text"}
						</Button>
					</Box>

					<CollectionFieldsTable
						title={selectedCollection.displayName}
						collectionId={selectedCollection.id}
						slug={selectedCollection.slug}
						fields={selectedCollection.fields}
						generatedFields={generatedFields}
						isApplying={isApplying}
						isApplyingAll={isApplyingAll}
						onSuggestedTextChange={handleSuggestedTextChange}
						onApplyRow={handleApplyRow}
						onApplyAll={handleApplyAll}
					/>
				</Box>
			) : null}
		</Box>
	);
}

function App() {
	return (
		<ThemeProvider theme={theme}>
			<AppContent />
		</ThemeProvider>
	);
}

export default App;