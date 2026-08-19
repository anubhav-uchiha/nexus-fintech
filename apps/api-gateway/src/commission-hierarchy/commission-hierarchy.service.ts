import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { COMMISSION_PATTERNS } from '@nexus/common/commission/commission.patterns';
import { CreateCommissionHierarchyDto } from '@nexus/common/commission/dto/create-commission-hierarchy.dto';
import { UpdateCommissionHierarchyDto } from '@nexus/common/commission/dto/update-commission-hierarchy.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CommissionHierarchyService implements OnModuleInit {
  constructor(
    @Inject('COMMISSION_HIERARCHY_SERVICE')
    private readonly commissionClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.CREATE_HIERARCHY,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.GET_ALL_HIERARCHY,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.GET_ONE_HIERARCHY,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.RESOLVE_HIERARCHY,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.GET_CHILDREN_HIERARCHY,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.GET_PARENT_HIERARCHY,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.UPDATE_HIERARCHY,
    );

    this.commissionClient.subscribeToResponseOf(
      COMMISSION_PATTERNS.DELETE_HIERARCHY,
    );

    await this.commissionClient.connect();
  }

  async create(dto: CreateCommissionHierarchyDto) {
    return firstValueFrom(
      this.commissionClient.send(COMMISSION_PATTERNS.CREATE_HIERARCHY, dto),
    );
  }

  async getAll(serviceType?: string) {
    return firstValueFrom(
      this.commissionClient.send(COMMISSION_PATTERNS.GET_ALL_HIERARCHY, {
        serviceType,
      }),
    );
  }

  async getById(id: string) {
    return firstValueFrom(
      this.commissionClient.send(COMMISSION_PATTERNS.GET_ONE_HIERARCHY, { id }),
    );
  }

  async resolveHierarchy(sourceUserId: string, serviceType: string) {
    return firstValueFrom(
      this.commissionClient.send(COMMISSION_PATTERNS.RESOLVE_HIERARCHY, {
        sourceUserId,
        serviceType,
      }),
    );
  }

  async getChildren(parentUserId: string, serviceType?: string) {
    return firstValueFrom(
      this.commissionClient.send(COMMISSION_PATTERNS.GET_CHILDREN_HIERARCHY, {
        parentUserId,
        serviceType,
      }),
    );
  }

  async getParents(childUserId: string, serviceType?: string) {
    return firstValueFrom(
      this.commissionClient.send(COMMISSION_PATTERNS.GET_PARENT_HIERARCHY, {
        childUserId,
        serviceType,
      }),
    );
  }

  async update(id: string, dto: UpdateCommissionHierarchyDto) {
    return firstValueFrom(
      this.commissionClient.send(COMMISSION_PATTERNS.UPDATE_HIERARCHY, {
        id,
        dto,
      }),
    );
  }

  async delete(id: string) {
    return firstValueFrom(
      this.commissionClient.send(COMMISSION_PATTERNS.DELETE_HIERARCHY, {
        id,
      }),
    );
  }
}
