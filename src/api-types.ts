/**
 * Listing Factory API Types
 * Unified Source of Truth for Frontend/Backend
 */

import { Listing, ListingInput } from "../shared/types/listing";

// ============================================================================
// Core API Response Types
// ============================================================================

export interface APIResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

// Alias for compatibility
export type ApiResponse<T = unknown> = APIResponse<T>;

export type ListingsResponse = APIResponse<Listing[]>;
export type ListingCreateRequest = ListingInput;
export type ListingCreateResponse = APIResponse<Listing>;

// ============================================================================
// Re-export from Worker - Core Types
// ============================================================================

// Agent and Project Types (imported first for use in other types)
import type { BehaviorType, ProjectType } from "../worker-legacy/agents/core/types";
export type { BehaviorType, ProjectType };

export type { AgentState, PhasicState } from "../worker-legacy/agents/core/state";

// File and Template Types
export type { FileOutputType, FileConceptType, PhaseConceptType } from "../worker-legacy/agents/schemas";
export type { TemplateDetails } from "../worker-legacy/services/sandbox/sandboxTypes";

// Image and Media Types
export type { ImageAttachment } from "../worker-legacy/types/image-attachment";
export {
	SUPPORTED_IMAGE_MIME_TYPES,
	isSupportedImageType,
	MAX_IMAGE_SIZE_BYTES,
	MAX_IMAGES_PER_MESSAGE,
	type SupportedImageMimeType,
	type ProcessedImageAttachment,
	getFileExtensionFromMimeType,
} from "../worker-legacy/types/image-attachment";

// Blueprint Types
export type { 
	PhasicBlueprint, 
	LitePhasicBlueprint,
	AgenticBlueprint,
	TemplateSelection,
	Blueprint,
} from "../worker-legacy/agents/schemas";

// Blueprint Type (phasic | agentic)
export type BlueprintType = BehaviorType;

// Feature and Capability Types
export type { ViewMode } from "../worker-legacy/agents/core/features/types";
export type {
	FeatureCapabilities,
	FeatureDefinition,
	ViewDefinition,
	PlatformCapabilities,
} from "../worker-legacy/agents/core/features/types";

export {
	DEFAULT_FEATURE_DEFINITIONS,
	getBehaviorTypeForProject,
} from "../worker-legacy/agents/core/features/types";

// Model Configuration Types
import type { ModelConfig } from "../worker-legacy/agents/inferutils/config.types";
export type { ModelConfig };
export type { 
	UserModelConfigWithMetadata,
	UserStats,
	UserActivity,
} from "../worker-legacy/database/types";

// ============================================================================
// Auth and Session Types
// ============================================================================

import type {
	AuthUser,
	AuthSession,
	OAuthProvider,
} from "../worker-legacy/types/auth-types";

export type {
	AuthUser,
	AuthSession,
	OAuthProvider,
	TokenPayload,
	AuthUserSession,
	AuthResult,
	OAuthUserInfo,
	OAuthTokens,
	ApiKeyInfo,
	PasswordValidationResult,
	SecurityContext,
	AuditLogEntry,
	PendingWsTicket,
	TicketConsumptionResult,
} from "../worker-legacy/types/auth-types";

// ============================================================================
// Vault and Secrets Types
// ============================================================================

export type {
	KdfAlgorithm,
	SecretType,
	SecretMetadata,
	VaultConfig,
	Argon2Params,
	VaultStatusResponse,
	VaultConfigResponse,
	SetupVaultRequest,
	StoreSecretRequest,
	EncryptedSecret,
	SecretListItem,
} from "../worker-legacy/services/secrets/vault-types";

export type { SecretTemplate } from "../worker-legacy/types/secretsTemplates";

// ============================================================================
// Rate Limiting Types
// ============================================================================

export type { RateLimitError } from "../worker-legacy/services/rate-limit/errors";

export interface RateLimitExceededError {
	message: string;
	limitType: string;
	limit?: number;
	period?: number;
	suggestions?: string[];
}

export type SecurityErrorType = 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_SIGNATURE';

export interface SecurityError extends Error {
	type: SecurityErrorType;
	details?: unknown;
}

// ============================================================================
// Database and App Types
// ============================================================================

import type { UserActivity as UserActivityType } from "../worker-legacy/database/types";

export type {
	PaginationInfo,
	EnhancedAppData,
	AppWithFavoriteStatus,
	FavoriteToggleResult,
	PaginatedResult,
	PaginationParams,
	TimePeriod,
	AppSortOption,
	SortOrder,
	BaseAppQueryOptions,
	AppQueryOptions,
	PublicAppQueryOptions,
	OwnershipResult,
	AppVisibilityUpdateResult,
	SimpleAppCreation,
	AppForForkResult,
	BatchAppStats,
	TeamStats,
	BoardStats,
	AppStats,
	Visibility,
	UserActivity as UserActivityType,
} from "../worker-legacy/database/types";

// ============================================================================
// Controller Response Types - Apps
// ============================================================================

export type {
	AppWithUserAndStats,
	AppsListData,
	PublicAppsData,
	FavoriteToggleData,
	CreateAppData,
	UpdateAppVisibilityData,
	AppDeleteData,
} from "../worker-legacy/api/controllers/apps/types";

export type {
	AppDetailsData,
	AppStarToggleData,
	GitCloneTokenData,
} from "../worker-legacy/api/controllers/appView/types";

// ============================================================================
// Controller Response Types - Model Config
// ============================================================================

export type {
	ModelConfigsData,
	ModelConfigData,
	ModelConfigUpdateData,
	ModelConfigTestData,
	ModelConfigResetData,
	ModelConfigDefaultsData,
	ModelConfigDeleteData,
	ByokProvidersData,
	UserProviderStatus,
	ModelsByProvider,
} from "../worker-legacy/api/controllers/modelConfig/types";

// ============================================================================
// Controller Response Types - Model Providers
// ============================================================================

export interface ModelProviderData {
	id: string;
	provider: string;
	config: Record<string, unknown>;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface ModelProviderCreateData {
	provider: ModelProviderData;
	message: string;
}

export interface ModelProviderUpdateData {
	provider: ModelProviderData;
	message: string;
}

export interface ModelProviderDeleteData {
	success: boolean;
	message: string;
}

export interface ModelProviderTestData {
	success: boolean;
	message: string;
	error?: string;
}

// CreateProviderRequest, UpdateProviderRequest, TestProviderRequest
export interface CreateProviderRequest {
	provider: string;
	config: Record<string, unknown>;
}

export interface UpdateProviderRequest {
	providerId: string;
	config: Record<string, unknown>;
}

export interface TestProviderRequest {
	provider: string;
	config: Record<string, unknown>;
}

export interface ModelProvidersListData {
	providers: ModelProviderData[];
}

// ============================================================================
// Controller Response Types - Secrets
// ============================================================================

export type { SecretTemplatesData } from "../worker-legacy/api/controllers/secrets/types";

// ============================================================================
// Controller Response Types - Stats and Analytics
// ============================================================================

export type { UserStatsData } from "../worker-legacy/api/controllers/stats/types";

export interface UserActivityData {
	activities: UserActivityType[];
}

export type {
	UserAnalyticsResponseData,
	AgentAnalyticsResponseData,
} from "../worker-legacy/api/controllers/analytics/types";

// ============================================================================
// Controller Response Types - User and Profile
// ============================================================================

export type { UserAppsData, ProfileUpdateData } from "../worker-legacy/api/controllers/user/types";

// ============================================================================
// Controller Response Types - Capabilities
// ============================================================================

export type { CapabilitiesData } from "../worker-legacy/api/controllers/capabilities/types";

// ============================================================================
// Controller Response Types - Status
// ============================================================================

export type { PlatformStatusData } from "../worker-legacy/api/controllers/status/types";

// ============================================================================
// Agent and Connection Types
// ============================================================================

export type {
	AgentConnectionData,
	CodeGenArgs,
	AgentPreviewResponse,
} from "../worker-legacy/api/controllers/agent/types";

// ============================================================================
// WebSocket Message Types
// ============================================================================

export type {
	WebSocketMessage,
	WebSocketMessageData,
	CodeFixEdits,
	ModelConfigsInfoMessage,
	AgentDisplayConfig,
	ModelConfigsInfo,
} from "../worker-legacy/api/websocketTypes";

// ============================================================================
// Conversation and Message Types
// ============================================================================

export type { ConversationMessage } from "../worker-legacy/agents/inferutils/common";

// ============================================================================
// Database Schema Types
// ============================================================================

export type { App } from "../worker-legacy/database/schema";

// ============================================================================
// Authentication Response Types
// ============================================================================

export interface LoginResponseData {
	user: Omit<AuthUser, 'isAnonymous'>;
	session: AuthSession;
	accessToken: string;
	redirectUrl?: string;
}

export interface RegisterResponseData {
	user: Omit<AuthUser, 'isAnonymous'>;
	session: AuthSession;
	accessToken: string;
	isNewUser: boolean;
	requiresEmailVerification?: boolean;
}

export interface ProfileResponseData {
	user: Omit<AuthUser, 'isAnonymous'>;
}

export interface AuthProvidersResponseData {
	providers: OAuthProvider[];
	hasOAuth?: boolean;
	requiresEmailAuth?: boolean;
}

export interface CsrfTokenResponseData {
	token: string;
	header: string;
}

export interface ActiveSessionsData {
	sessions: AuthSession[];
}

export interface ApiKeysData {
	keys: Array<{
		id: string;
		name: string;
		keyPreview: string;
		createdAt: Date | null;
		lastUsed: Date | null;
		isActive: boolean;
	}>;
}

// ============================================================================
// Constants
// ============================================================================

export const MAX_AGENT_QUERY_LENGTH = 5000;

// ============================================================================
// File Type Aliases
// ============================================================================

/**
 * FileType represents different code/text file types
 * This is a string union type for syntax highlighting and code generation
 */
export type SyntaxHighlightingFileType = 'typescript' | 'javascript' | 'css' | 'html' | 'json' | 'plaintext';

/**
 * FileType is now an object representing a file with content and metadata
 * Previously used as a string, now represents the actual file structure
 */
export interface FileType {
	filePath: string;
	fileContents: string;
	explanation?: string;
	language?: string;
	isGenerating?: boolean;
	needsFixing?: boolean;
	hasErrors?: boolean;
}

// ============================================================================
// Model Configuration Update Type
// ============================================================================

export interface ModelConfigUpdate extends Partial<ModelConfig> {}

// ============================================================================
// Agent Streaming Response
// ============================================================================

export interface AgentStreamingResponse {
	type: string;
	data?: unknown;
}



// ============================================================================
// GitHub Export Types
// ============================================================================

export interface GitHubExportOptions {
	repository?: string;
	branch?: string;
	commitMessage?: string;
	includeConfig?: boolean;
}

export interface GitHubExportResult {
	success: boolean;
	url?: string;
	error?: string;
	message?: string;
}
