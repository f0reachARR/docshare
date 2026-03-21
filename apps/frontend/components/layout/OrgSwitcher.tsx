'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Building2Icon, ChevronDownIcon } from 'lucide-react';

export function OrgSwitcher() {
  const { organizations } = useAuth();
  const { organizationId, setOrganizationId, currentOrg } = useOrganization();

  if (organizations.length === 0) {
    return (
      <span className='flex items-center gap-1 text-sm text-muted-foreground'>
        <Building2Icon className='h-4 w-4' />
        所属なし
      </span>
    );
  }

  if (organizations.length === 1) {
    return (
      <span className='flex items-center gap-1 text-sm'>
        <Building2Icon className='h-4 w-4' />
        {currentOrg?.name ?? organizations[0].name}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant='ghost' size='sm' className='gap-1' />}>
        <Building2Icon className='h-4 w-4' />
        {currentOrg?.name ?? '大学を選択'}
        <ChevronDownIcon className='h-3 w-3' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuGroup>
          <DropdownMenuLabel>大学を切り替え</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setOrganizationId(org.id)}
            className={org.id === organizationId ? 'font-semibold' : ''}
          >
            {org.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
