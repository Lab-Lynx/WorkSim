import { Link } from 'react-router-dom';
import { useExperienceProfile } from '@/hooks/profile/useExperienceProfile';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import PracticeRecordNotice from '@/components/profile/PracticeRecordNotice';
import ExperienceItem from '@/components/profile/ExperienceItem';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

export default function ExperienceProfilePage(): React.JSX.Element {
	useDocumentTitle('Experience profile');
	const profile = useExperienceProfile();

	return (
		<div className="flex flex-col gap-6">
			<h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight text-foreground outline-none">
				Your experience profile
			</h1>
			<PracticeRecordNotice />

			{profile.isLoading ? (
				<div role="status" aria-label="Loading experience profile" className="space-y-4">
					<div className="h-5 w-48 animate-pulse bg-muted" />
					<div className="h-24 animate-pulse bg-muted" />
				</div>
			) : profile.isError ? (
				<ErrorState
					message={profile.error?.message || 'Could not load your experience profile.'}
					onRetry={() => void profile.refetch()}
				/>
			) : !profile.data?.length ? (
				<EmptyState
					title="No completed tickets yet."
					description="Finish your first ticket and it will appear here."
				>
					<Button asChild>
						<Link to="/dashboard">Go to dashboard</Link>
					</Button>
				</EmptyState>
			) : (
				<>
					<p className="text-sm text-muted-foreground">
						{profile.data.length} completed {profile.data.length === 1 ? 'ticket' : 'tickets'}
					</p>
					<section aria-label="Completed tickets">
						{profile.data.map((item) => <ExperienceItem key={item.ticketId} item={item} />)}
					</section>
				</>
			)}
		</div>
	);
}
